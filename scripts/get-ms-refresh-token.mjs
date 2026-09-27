// One-time helper for Excel sync with a PERSONAL Microsoft account (OneDrive).
// Usage: MS_CLIENT_ID=xxxx node scripts/get-ms-refresh-token.mjs
// Follow the printed instructions, then copy MS_REFRESH_TOKEN into your env vars.
const clientId = process.env.MS_CLIENT_ID;
const tenant = process.env.MS_TENANT_ID || 'consumers';
if (!clientId) {
    console.error('Set MS_CLIENT_ID first, e.g. MS_CLIENT_ID=xxxx node scripts/get-ms-refresh-token.mjs');
    process.exit(1);
}
const scope = 'Files.ReadWrite offline_access';
const base = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;

const dc = await (await fetch(`${base}/devicecode`, { method: 'POST', body: new URLSearchParams({ client_id: clientId, scope }) })).json();
if (!dc.device_code) {
    console.error('Could not start sign-in:', dc.error_description || dc);
    process.exit(1);
}
console.log(`\n${dc.message}\n`);

const deadline = Date.now() + dc.expires_in * 1000;
while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, (dc.interval || 5) * 1000));
    const tok = await (await fetch(`${base}/token`, {
        method: 'POST',
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: clientId, device_code: dc.device_code })
    })).json();
    if (tok.refresh_token) {
        console.log('Signed in. Add this to your environment variables:\n');
        console.log(`MS_REFRESH_TOKEN=${tok.refresh_token}\n`);
        const me = await (await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children?$select=name,id', { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
        const files = (me.value || []).filter((f) => f.name.endsWith('.xlsx'));
        if (files.length) {
            console.log('Excel files in your OneDrive root (use the id in EXCEL_WORKBOOK_URL):');
            files.forEach((f) => console.log(`  ${f.name}  ->  https://graph.microsoft.com/v1.0/me/drive/items/${f.id}/workbook`));
        }
        process.exit(0);
    }
    if (tok.error && tok.error !== 'authorization_pending' && tok.error !== 'slow_down') {
        console.error('Sign-in failed:', tok.error_description);
        process.exit(1);
    }
}
console.error('Timed out - run the script again.');
