/**
 * GlidePay — Free E-File Exporters
 *
 * Generates the electronic files that the *free* government systems accept, so
 * an employer can e-file without a paid provider:
 *   • W-2 / W-3  → SSA EFW2 fixed-width file, uploaded free at SSA Business
 *                  Services Online (BSO).  Spec: SSA Publication 42-007 (EFW2).
 *   • 1099-NEC   → IRS IRIS CSV, uploaded free at the IRIS Taxpayer Portal.
 *
 * These are pure functions over the app state — no network, no fees. The final
 * upload to BSO / IRIS is done by a human on the free portal.
 *
 * IMPORTANT — data prerequisites:
 *   A filable return requires employee SSN + home address and the employer
 *   address. The current data model does not store these, so the generators
 *   read them from optional fields when present (emp.ssn, emp.address, emp.city,
 *   emp.zip; company.address/city/state/zip) and otherwise emit blanks. Always
 *   run checkEfileReadiness() first, and validate an EFW2 file with SSA's free
 *   AccuWage tool before filing.
 */

// ── Field encoders ───────────────────────────────────────────────────────────
/** Alphanumeric: uppercased, left-justified, space-padded, fixed length. */
function _alpha(value, len) {
    return String(value ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9 &'\-\/.]/g, '')
        .padEnd(len, ' ')
        .slice(0, len);
}
/** Digits only, right-justified, zero-padded (SSN, EIN). */
function _digits(value, len) {
    return String(value ?? '').replace(/\D/g, '').padStart(len, '0').slice(-len);
}
/** Money → cents, right-justified, zero-padded, no decimal point. */
function _money(value, len = 11) {
    const cents = Math.max(0, Math.round((Number(value) || 0) * 100));
    return String(cents).padStart(len, '0').slice(-len);
}
/** Pad a record to the fixed EFW2 length (512). */
function _pad512(record) {
    return (record + ' '.repeat(512)).slice(0, 512);
}

function _splitName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/);
    const first = parts.shift() || '';
    const last  = parts.pop() || '';
    const middle = parts.join(' ');
    return { first, middle, last };
}

// ── Per-employee YTD aggregation (mirrors getW2HTML) ─────────────────────────
const _SS_WAGE_BASE = 176100;

function aggregateEmployeeYearTotals(state, employeeId) {
    const t = { gross: 0, fitWages: 0, ssWages: 0, medWages: 0, fit: 0, ss: 0, med: 0, sit: 0, retirement: 0 };
    (state.payrollHistory || []).forEach(run => {
        const d = run.details && run.details[employeeId];
        if (!d) return;
        t.gross     += d.grossPay || 0;
        t.fitWages  += (d.grossPay || 0) - (d.preTaxDeductions || 0);
        t.ssWages   += Math.min(d.grossPay || 0, _SS_WAGE_BASE);
        t.medWages  += d.grossPay || 0;
        t.fit       += d.taxes?.federalIncomeTax || 0;
        t.ss        += d.taxes?.socialSecurity || 0;
        t.med       += d.taxes?.medicare || 0;
        t.sit       += d.taxes?.stateIncomeTax || 0;
        t.retirement += d.deduction401k || 0;
    });
    return t;
}

// ── Readiness preflight ──────────────────────────────────────────────────────
/**
 * Inspect the data required for a free e-file and report what's missing.
 * type: 'w2' (W-2 employees) | 'nec' (1099 contractors)
 * Returns { ready, employerMissing:[], employees:[{id,name,missing:[]}] }
 */
function checkEfileReadiness(state, type = 'w2') {
    const s = state.settings || {};
    const employerMissing = [];
    if (!s.ein)                        employerMissing.push('Employer EIN');
    if (!s.companyName)                employerMissing.push('Employer name');
    if (!(s.address || s.companyAddress)) employerMissing.push('Employer address');
    if (!(s.city  || s.companyCity))   employerMissing.push('Employer city');
    if (!(s.zip   || s.companyZip))    employerMissing.push('Employer ZIP');

    const wantW2 = type === 'w2';
    const people = (state.employees || []).filter(e =>
        wantW2 ? e.classification !== '1099' : e.classification === '1099');

    const employees = people.map(e => {
        const missing = [];
        if (!e.ssn && !e.tin)  missing.push(wantW2 ? 'SSN' : 'SSN/TIN');
        if (!e.address)        missing.push('Street address');
        if (!e.city)           missing.push('City');
        if (!e.state)          missing.push('State');
        if (!e.zip)            missing.push('ZIP');
        return { id: e.id, name: e.name, missing };
    });

    const ready = employerMissing.length === 0 && employees.length > 0 &&
        employees.every(e => e.missing.length === 0);
    return { ready, employerMissing, employees, count: people.length };
}

// ── EFW2 (W-2) generator — SSA Pub 42-007 ────────────────────────────────────
/**
 * Build an EFW2 file (RA submitter, RE employer, RW employee, RT totals, RF
 * final). Money fields are cents, zero-filled, 11 wide; identity fields are
 * space-filled. Validate with SSA AccuWage before filing.
 */
function generateEFW2(state, year) {
    year = year || new Date().getFullYear();
    const s = state.settings || {};
    const ein = _digits(s.ein, 9);
    const addr  = s.address || s.companyAddress || '';
    const city  = s.city    || s.companyCity    || '';
    const st    = s.state   || s.companyState   || '';
    const zip   = _digits(s.zip || s.companyZip || '', 5);

    const lines = [];

    // RA — Submitter Record
    let ra = 'RA';
    ra += _digits(ein, 9);                 // Submitter EIN
    ra += _alpha('', 9);                    // User ID (BSO) — filled at upload
    ra += _alpha('', 5);                    // blanks / software vendor code area
    ra += _alpha(s.companyName, 57);        // Submitter name
    ra += _alpha(addr, 22);                 // Location address
    ra += _alpha('', 22);                   // Delivery address
    ra += _alpha(city, 22);                 // City
    ra += _alpha(st, 2);                    // State
    ra += zip;                              // ZIP
    lines.push(_pad512(ra));

    // RE — Employer Record
    let re = 'RE';
    re += String(year);                     // Tax year (4)
    re += _alpha('', 1);                     // Agent indicator
    re += ein;                              // Employer EIN (9)
    re += _alpha('', 9);                     // Agent-for EIN
    re += _alpha('', 1);                     // Terminating business indicator
    re += _alpha('', 4);                     // Establishment number
    re += _alpha('', 9);                     // Other EIN
    re += _alpha(s.companyName, 57);        // Employer name
    re += _alpha(addr, 22);                 // Location address
    re += _alpha('', 22);                   // Delivery address
    re += _alpha(city, 22);                 // City
    re += _alpha(st, 2);                    // State
    re += zip;                              // ZIP
    lines.push(_pad512(re));

    // RW — Employee Wage Records
    const w2Emps = (state.employees || []).filter(e => e.classification !== '1099');
    const totals = { box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0, def: 0 };
    let rwCount = 0;

    w2Emps.forEach(e => {
        const t = aggregateEmployeeYearTotals(state, e.id);
        const nm = _splitName(e.name);
        let rw = 'RW';
        rw += _digits(e.ssn || e.tin, 9);   // SSN
        rw += _alpha(nm.first, 15);
        rw += _alpha(nm.middle, 15);
        rw += _alpha(nm.last, 20);
        rw += _alpha('', 4);                 // Suffix
        rw += _alpha(e.address, 22);         // Location address
        rw += _alpha('', 22);               // Delivery address
        rw += _alpha(e.city, 22);
        rw += _alpha(e.state, 2);
        rw += _digits(e.zip, 5);
        rw += _alpha('', 4);                 // ZIP extension
        rw += _alpha('', 5);                 // blank
        rw += _alpha('', 23);               // Foreign state/province
        rw += _alpha('', 15);               // Foreign postal code
        rw += _alpha('', 2);                 // Country code
        rw += _money(t.fitWages);            // Box 1 — Wages, tips, other comp
        rw += _money(t.fit);                 // Box 2 — Federal income tax withheld
        rw += _money(t.ssWages);             // Box 3 — Social security wages
        rw += _money(t.ss);                  // Box 4 — Social security tax
        rw += _money(t.medWages);            // Box 5 — Medicare wages
        rw += _money(t.med);                 // Box 6 — Medicare tax
        rw += _money(0);                     // Box 7 — Social security tips
        rw += _money(0);                     // (obsolete advance EIC)
        rw += _money(0);                     // Box 10 — Dependent care
        rw += _money(t.retirement);          // Box 12 — Deferred comp (401k)
        lines.push(_pad512(rw));
        rwCount++;
        totals.box1 += t.fitWages; totals.box2 += t.fit;
        totals.box3 += t.ssWages;  totals.box4 += t.ss;
        totals.box5 += t.medWages; totals.box6 += t.med;
        totals.def  += t.retirement;
    });

    // RT — Total Record
    let rt = 'RT';
    rt += String(rwCount).padStart(7, '0'); // Number of RW records
    rt += _money(totals.box1, 15);
    rt += _money(totals.box2, 15);
    rt += _money(totals.box3, 15);
    rt += _money(totals.box4, 15);
    rt += _money(totals.box5, 15);
    rt += _money(totals.box6, 15);
    rt += _money(0, 15);                     // SS tips
    rt += _money(0, 15);                     // advance EIC
    rt += _money(0, 15);                     // dependent care
    rt += _money(totals.def, 15);            // deferred comp
    lines.push(_pad512(rt));

    // RF — Final Record
    let rf = 'RF';
    rf += _alpha('', 5);
    rf += String(rwCount).padStart(9, '0'); // Number of RW records in file
    lines.push(_pad512(rf));

    return lines.join('\r\n') + '\r\n';
}

// ── 1099-NEC IRIS CSV generator ──────────────────────────────────────────────
/**
 * Build a CSV for the IRS IRIS Taxpayer Portal (free 1099 e-filing). Columns
 * follow the IRIS 1099-NEC upload template; the employer uploads this at the
 * IRIS portal (a free IRIS TCC is required to enroll).
 */
function generate1099IRISCSV(state, year) {
    year = year || new Date().getFullYear();
    const s = state.settings || {};

    const headers = [
        'Tax Year', 'Payer EIN', 'Payer Name',
        'Recipient TIN', 'Recipient Name', 'Recipient Address',
        'Recipient City', 'Recipient State', 'Recipient ZIP',
        'Box 1 Nonemployee Compensation', 'Box 4 Federal Income Tax Withheld',
    ];

    const esc = v => {
        const str = String(v ?? '');
        return /[",\r\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
    };

    const rows = [headers.join(',')];
    (state.employees || [])
        .filter(e => e.classification === '1099')
        .forEach(e => {
            const t = aggregateEmployeeYearTotals(state, e.id);
            rows.push([
                year,
                s.ein || '',
                s.companyName || '',
                e.ssn || e.tin || '',
                e.name || '',
                e.address || '',
                e.city || '',
                e.state || '',
                e.zip || '',
                (t.gross || 0).toFixed(2),
                (t.fit || 0).toFixed(2),
            ].map(esc).join(','));
        });

    return rows.join('\r\n') + '\r\n';
}

// Expose for both browser (window) and Node (verify/tests).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkEfileReadiness, generateEFW2, generate1099IRISCSV,
        aggregateEmployeeYearTotals,
    };
}
