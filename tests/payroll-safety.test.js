const test = require("node:test");
const assert = require("node:assert/strict");
const { calculatePayroll, SUPPORTED_TAX_STATES } = require("../payroll-engine.js");

const employee = {
    classification: "w2",
    type: "hourly",
    rate: 25,
    payFrequency: "biweekly",
    filingStatus: "single",
    state: "CO",
    benefits: {},
    garnishments: [],
};

test("unsupported state tax jurisdictions fail closed", () => {
    assert.equal(SUPPORTED_TAX_STATES.includes("CO"), false);
    assert.throws(
        () => calculatePayroll(employee, { hours: 40 }, 0),
        /State tax calculation is not supported for CO/,
    );
});
