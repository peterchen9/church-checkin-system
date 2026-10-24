const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/templates/eureka/barcode_search.html`, 'utf8')
    .split('<script>')[1].split("document.getElementById('search-form').addEventListener")[0];

async function verify(valid) {
    let printed = 0, cleared = 0, removed = 0, reset = 0, focused = 0;
    const handlers = {};
    const controls = [{disabled: false}];
    const form = {querySelectorAll: () => controls, reset: () => reset++};
    const results = {querySelectorAll: () => [], replaceChildren: () => cleared++};
    const status = {textContent: ''};
    const frame = {
        style: {}, setAttribute() {}, remove: () => removed++,
        addEventListener: (name, handler) => handlers[name] = handler,
        contentDocument: valid === null ? null : {querySelectorAll: () => valid ? [1, 2, 3] : [], fonts: {ready: Promise.resolve()}},
        contentWindow: {
            addEventListener: (name, handler) => handlers[name] = handler,
            requestAnimationFrame: callback => callback(), print: () => printed++,
        },
    };
    const elements = {'search-form': form, results, status, 'scanner-input': {focus: () => focused++}};
    const context = vm.createContext({document: {
        getElementById: id => elements[id], createElement: () => frame,
        body: {append() {}},
    }, setTimeout: callback => callback()});
    vm.runInContext(source, context);
    await context.printMemberLabels({church_id: 123});
    await context.printMemberLabels({church_id: 123}); // Ignore double clicks.
    await handlers.load();
    if (valid) {
        assert.equal(printed, 1);
        assert.equal(cleared, 0); // Keep results until the print lifecycle finishes.
        handlers.afterprint();
        assert.equal(reset, 1);
        assert.equal(cleared, 1);
        assert.equal(focused, 1);
        assert.equal(status.textContent, '');
    } else {
        assert.equal(printed, 0);
        assert.equal(cleared, 0); // Preserve the selection after a loading failure.
        assert.match(status.textContent, /載入失敗/);
    }
    assert.equal(removed, 1);
    assert.equal(controls[0].disabled, false);
}
(async () => {
    await verify(true);
    await verify(false);
    await verify(null); // Blocked iframe: contentDocument is null.
    console.log('Background print lifecycle and failure recovery passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
