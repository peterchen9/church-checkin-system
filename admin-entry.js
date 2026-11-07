// All management pages belong to this one official back office.
(() => {
    const officialOrigin = 'http://192.168.16.240:8033';
    const current = new URL(window.location.href);
    let target;
    if (current.pathname.endsWith('/login.html') || current.pathname.endsWith('/official-login.php')) {
        target = new URL('/official-login.php', officialOrigin);
        target.search = current.pathname.endsWith('/official-login.php') ? current.search : '?v=20261027-login-return';
    } else if (current.pathname.endsWith('/contact_form.html')) {
        target = new URL('/contact_form.html' + current.search, officialOrigin);
    } else {
        const tabs = new Set(['sunday-records', 'logs', 'events', 'employees', 'contacts']);
        const requested = current.searchParams.get('tab') || current.hash.replace(/^#tab-/, '');
        target = new URL('/admin.html', officialOrigin);
        if (tabs.has(requested) && requested !== 'sunday-records') target.searchParams.set('tab', requested);
    }
    if (current.href !== target.href) window.location.replace(target.href);
})();
