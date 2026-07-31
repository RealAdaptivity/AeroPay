/**
 * GlidePay — Supabase Data Layer
 * Replaces all localStorage state with real database operations.
 *
 * Project : GlidePay
 * URL     : https://ojvnxnlrghatkwjrlnop.supabase.co
 *
 * Usage in app.js / index.html:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
 *   <script src="supabase.js"></script>
 *   <!-- then payroll-engine.js, components.js, app.js -->
 */

// ─────────────────────────────────────────────
// CLIENT INIT
// ─────────────────────────────────────────────
const SUPABASE_URL  = 'https://ojvnxnlrghatkwjrlnop.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_4bJShv083TK7zHdk32fq5w_dJTAQ1nj';

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

/** Throw a readable error if a Supabase call fails. */
function _check(result, context) {
    if (result.error) {
        console.error(`[AeroDB] ${context}:`, result.error.message);
        throw new Error(`${context}: ${result.error.message}`);
    }
    return result.data;
}

/** Convert a DB employee row → the shape app.js expects. */
function _toAppEmployee(row) {
    return {
        id:             row.id,
        name:           row.name,
        email:          row.email,
        role:           row.role,
        department:     row.department,
        classification: row.classification,
        type:           row.type,
        rate:           parseFloat(row.rate),
        payFrequency:   row.pay_frequency,
        filingStatus:   row.filing_status,
        state:          row.state,
        benefits: {
            rate401k:       parseFloat(row.rate_401k)      || 0,
            medicalPremium: parseFloat(row.medical_premium) || 0,
            reimbursement:  parseFloat(row.reimbursement)   || 0,
        },
        splitDeposits: {
            enabled:        row.split_deposits_enabled  || false,
            savingsPercent: parseFloat(row.split_savings_percent) || 0,
            savingsRouting: row.split_savings_routing   || '',
            savingsAccount: row.split_savings_account   || '',
        },
        bankRouting:    row.bank_routing       || '',
        bankLast4:      row.bank_account_last4  || '',
        stripePmId:     row.stripe_pm_id        || '',
        garnishments:   [],   // loaded separately via getGarnishments()
        isActive:       row.is_active,
        userId:         row.user_id,
    };
}

/** Convert a DB payroll_run row + line items → the shape app.js expects. */
function _toAppRun(run, lineItems = []) {
    const details = {};
    lineItems.forEach(li => {
        details[li.employee_id] = {
            grossPay:           parseFloat(li.gross_pay),
            regularEarnings:    parseFloat(li.regular_earnings),
            overtimeEarnings:   parseFloat(li.overtime_earnings),
            bonus:              parseFloat(li.bonus),
            commissions:        parseFloat(li.commissions),
            reimbursement:      parseFloat(li.reimbursement),
            preTaxDeductions:   parseFloat(li.pre_tax_deductions),
            deduction401k:      parseFloat(li.deduction_401k),
            deductionMedical:   parseFloat(li.deduction_medical),
            postTaxDeductions:  parseFloat(li.post_tax_deductions),
            garnishmentDeductions: parseFloat(li.garnishment_deductions),
            payAdvanceDeduction:   parseFloat(li.pay_advance_deduction),
            taxes: {
                federalIncomeTax:    parseFloat(li.federal_income_tax),
                socialSecurity:      parseFloat(li.social_security),
                medicare:            parseFloat(li.medicare),
                stateIncomeTax:      parseFloat(li.state_income_tax),
                totalEmployeeTaxes:  parseFloat(li.total_employee_taxes),
            },
            netPay:             parseFloat(li.net_pay),
            netPayChecking:     parseFloat(li.net_pay_checking),
            netPaySavings:      parseFloat(li.net_pay_savings),
            employerTaxes: {
                socialSecurity:      parseFloat(li.employer_social_security),
                medicare:            parseFloat(li.employer_medicare),
                futa:                parseFloat(li.futa),
                suta:                parseFloat(li.suta),
                totalEmployerTaxes:  parseFloat(li.total_employer_taxes),
            },
            totalEmployerTaxes: parseFloat(li.total_employer_taxes),
            totalPayrollCost:   parseFloat(li.total_payroll_cost),
        };
    });

    return {
        id:            run.id,
        date:          new Date(run.run_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        periodStart:   run.period_start,
        periodEnd:     run.period_end,
        status:        run.status,
        employeeCount: run.employee_count,
        grossPayroll:  parseFloat(run.gross_payroll),
        employerTaxes: parseFloat(run.employer_taxes),
        totalCost:     parseFloat(run.total_cost),
        details,
    };
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
const AeroDB = {

    /**
     * Sign up a new company owner. Creates auth user, company row,
     * and company_users membership in one flow.
     *
     * @param {string} email
     * @param {string} password
     * @param {string} companyName
     * @returns {{ user, company }}
     */
    async signUp(email, password, companyName) {
        const { data: authData, error: authError } = await _sb.auth.signUp({ email, password });
        if (authError) throw new Error(`Sign-up failed: ${authError.message}`);

        const user = authData.user;

        // Create company
        const company = _check(
            await _sb.from('companies').insert({ name: companyName, owner_id: user.id }).select().single(),
            'signUp → create company'
        );

        // Create company_users record
        _check(
            await _sb.from('company_users').insert({ company_id: company.id, user_id: user.id, role: 'owner' }),
            'signUp → company_users'
        );

        // Bootstrap integration settings row
        await _sb.from('integrations').insert({ company_id: company.id }).maybeSingle();

        return { user, company };
    },

    /**
     * Sign in an existing user.
     * @returns {{ user, session }}
     */
    async signIn(email, password) {
        const { data, error } = await _sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(`Sign-in failed: ${error.message}`);
        return data;
    },

    /** Sign out the current user. */
    async signOut() {
        await _sb.auth.signOut();
    },

    /**
     * Returns the currently authenticated user, or null.
     */
    async getUser() {
        const { data: { user } } = await _sb.auth.getUser();
        return user;
    },

    /**
     * Subscribe to auth state changes.
     * callback(event, session) — event is 'SIGNED_IN' | 'SIGNED_OUT' | etc.
     */
    onAuthChange(callback) {
        return _sb.auth.onAuthStateChange(callback);
    },

    // ─────────────────────────────────────────
    // COMPANY
    // ─────────────────────────────────────────

    /** Fetch the company record for the logged-in user. */
    async getCompany() {
        const data = _check(
            await _sb.from('companies').select('*').single(),
            'getCompany'
        );
        return {
            id:                       data.id,
            name:                     data.name,
            ein:                      data.ein,
            bankName:                 data.bank_name,
            routingNumber:            data.routing_number,
            accountNumber:            data.account_number,
            paymentType:              data.payment_type,
            stripeAccountId:          data.stripe_account_id          || '',
            stripeAccountStatus:      data.stripe_account_status       || 'not_created',
            stripeFinancialAccountId: data.stripe_financial_account_id || '',
        };
    },

    /** Update company settings (EIN, bank details, name). */
    async saveCompany(fields) {
        _check(
            await _sb.from('companies').update({
                name:           fields.companyName,
                ein:            fields.ein,
                bank_name:      fields.bankName,
                routing_number: fields.routingNumber,
                account_number: fields.accountNumber,
                payment_type:   fields.paymentType,
            }).eq('owner_id', (await this.getUser()).id),
            'saveCompany'
        );
    },

    // ─────────────────────────────────────────
    // EMPLOYEES
    // ─────────────────────────────────────────

    /** Return all active employees for the current company. */
    async getEmployees() {
        const rows = _check(
            await _sb.from('employees').select('*').eq('is_active', true).order('name'),
            'getEmployees'
        );
        const employees = rows.map(_toAppEmployee);

        // Attach garnishments to each employee
        const garns = await this.getGarnishments();
        employees.forEach(emp => {
            emp.garnishments = garns.filter(g => g.employeeId === emp.id);
        });

        return employees;
    },

    /** Add a new employee. Returns the created employee in app shape. */
    async addEmployee(emp) {
        const company = await this.getCompany();
        const row = _check(
            await _sb.from('employees').insert({
                company_id:      company.id,
                name:            emp.name,
                email:           emp.email,
                role:            emp.role,
                department:      emp.department,
                classification:  emp.classification,
                type:            emp.type,
                rate:            emp.rate,
                pay_frequency:   emp.payFrequency,
                filing_status:   emp.filingStatus || 'single',
                state:           emp.state,
                rate_401k:       emp.benefits?.rate401k       || 0,
                medical_premium: emp.benefits?.medicalPremium  || 0,
                reimbursement:   emp.benefits?.reimbursement   || 0,
            }).select().single(),
            'addEmployee'
        );

        // Bootstrap PTO + benefits rows
        await _sb.from('pto_balances').insert({ company_id: company.id, employee_id: row.id, vacation_hours: 0, sick_hours: 0, personal_hours: 0 });
        await _sb.from('benefits').insert({ company_id: company.id, employee_id: row.id });

        await this.addAuditLog('Employee Added', `Added ${emp.name} as ${emp.classification.toUpperCase()}`, 'employee');

        return _toAppEmployee(row);
    },

    /** Update an existing employee. Preserves garnishments/split deposits. */
    async updateEmployee(id, emp) {
        _check(
            await _sb.from('employees').update({
                name:                    emp.name,
                email:                   emp.email,
                role:                    emp.role,
                department:              emp.department,
                classification:          emp.classification,
                type:                    emp.type,
                rate:                    emp.rate,
                pay_frequency:           emp.payFrequency,
                filing_status:           emp.filingStatus || 'single',
                state:                   emp.state,
                rate_401k:               emp.benefits?.rate401k        || 0,
                medical_premium:         emp.benefits?.medicalPremium   || 0,
                reimbursement:           emp.benefits?.reimbursement    || 0,
                split_deposits_enabled:  emp.splitDeposits?.enabled     || false,
                split_savings_percent:   emp.splitDeposits?.savingsPercent || 0,
                split_savings_routing:   emp.splitDeposits?.savingsRouting || '',
                split_savings_account:   emp.splitDeposits?.savingsAccount || '',
            }).eq('id', id),
            'updateEmployee'
        );

        await this.addAuditLog('Employee Updated', `Updated profile for ${emp.name}`, 'employee');
    },

    /** Soft-delete an employee (sets is_active = false). */
    async deleteEmployee(id) {
        const emp = (await _sb.from('employees').select('name').eq('id', id).single()).data;
        _check(
            await _sb.from('employees').update({ is_active: false }).eq('id', id),
            'deleteEmployee'
        );
        await this.addAuditLog('Employee Offboarded', `Deactivated ${emp?.name || id}`, 'employee');
    },

    // ─────────────────────────────────────────
    // ACH / BANK ACCOUNTS
    // ─────────────────────────────────────────

    /** Persist a confirmed Stripe bank PaymentMethod on an employee. */
    async saveAchBankAccount(employeeId, { paymentMethodId, last4, routing }) {
        _check(
            await _sb.from('employees').update({
                stripe_pm_id:       paymentMethodId,
                bank_account_last4: last4,
                bank_routing:       routing,
            }).eq('id', employeeId),
            'saveAchBankAccount'
        );
    },

    /** Return ACH transfer rows for a payroll run. */
    async getAchTransfers(payrollRunId) {
        const { data, error } = await _sb
            .from('ach_transfers')
            .select('*')
            .eq('payroll_run_id', payrollRunId)
            .order('created_at');
        if (error) console.error('[AeroDB] getAchTransfers:', error.message);
        return data || [];
    },

    // ─────────────────────────────────────────
    // TIMESHEETS
    // ─────────────────────────────────────────

    /**
     * Get the most recent timesheet for a given employee.
     * Returns a 7-element hours array [Mon..Sun].
     */
    async getTimesheet(employeeId) {
        const { data } = await _sb.from('timesheets')
            .select('hours, week_starting')
            .eq('employee_id', employeeId)
            .order('week_starting', { ascending: false })
            .limit(1)
            .maybeSingle();

        return data?.hours || [0, 0, 0, 0, 0, 0, 0];
    },

    /**
     * Get all current timesheets as the legacy { empId: [hours] } map.
     * Used to populate the payroll wizard step 1.
     */
    async getAllTimesheets() {
        const { data } = await _sb.from('timesheets')
            .select('employee_id, hours')
            .order('week_starting', { ascending: false });

        const map = {};
        // Keep only the most recent entry per employee
        (data || []).forEach(row => {
            if (!map[row.employee_id]) {
                map[row.employee_id] = row.hours;
            }
        });
        return map;
    },

    /** Save or update a timesheet for an employee for the current week. */
    async saveTimesheet(employeeId, hours) {
        const company = await this.getCompany();
        const monday  = _getMondayOfCurrentWeek();

        _check(
            await _sb.from('timesheets').upsert({
                company_id:    company.id,
                employee_id:   employeeId,
                week_starting: monday,
                hours:         hours,
            }, { onConflict: 'employee_id,week_starting' }),
            'saveTimesheet'
        );
    },

    // ─────────────────────────────────────────
    // PAYROLL RUNS
    // ─────────────────────────────────────────

    /** Return all payroll runs for the current company, newest first. */
    async getPayrollHistory() {
        const runs = _check(
            await _sb.from('payroll_runs')
                .select('*')
                .order('run_date', { ascending: false }),
            'getPayrollHistory'
        );

        if (!runs.length) return [];

        // Fetch all line items for these runs in one query
        const runIds = runs.map(r => r.id);
        const lineItems = _check(
            await _sb.from('payroll_line_items')
                .select('*')
                .in('payroll_run_id', runIds),
            'getPayrollHistory → lineItems'
        );

        return runs.map(run => {
            const items = lineItems.filter(li => li.payroll_run_id === run.id);
            return _toAppRun(run, items);
        });
    },

    /**
     * Save a completed payroll run (run header + one line item per employee).
     * Mirrors what submitPayrollRun() currently does to localStorage.
     *
     * @param {object} runSummary  { grossPayroll, employerTaxes, totalCost, employeeCount, periodStart, periodEnd }
     * @param {object} activeRunData  { [empId]: { results: {...} } }
     */
    async savePayrollRun(runSummary, activeRunData) {
        const company = await this.getCompany();
        const user    = await this.getUser();

        // Insert the run header
        const run = _check(
            await _sb.from('payroll_runs').insert({
                company_id:     company.id,
                run_date:       new Date().toISOString().slice(0, 10),
                period_start:   runSummary.periodStart,
                period_end:     runSummary.periodEnd,
                status:         'completed',
                gross_payroll:  runSummary.grossPayroll,
                employer_taxes: runSummary.employerTaxes,
                total_cost:     runSummary.totalCost,
                employee_count: runSummary.employeeCount,
                submitted_by:   user.id,
                approved_by:    user.id,
                submitted_at:   new Date().toISOString(),
                approved_at:    new Date().toISOString(),
            }).select().single(),
            'savePayrollRun → header'
        );

        // Insert one line item per employee
        const lineItems = Object.entries(activeRunData).map(([empId, data]) => {
            const r = data.results;
            return {
                payroll_run_id:          run.id,
                employee_id:             empId,
                company_id:              company.id,
                gross_pay:               r.grossPay,
                regular_earnings:        r.regularEarnings,
                overtime_earnings:       r.overtimeEarnings,
                bonus:                   r.bonus,
                commissions:             r.commissions,
                reimbursement:           r.reimbursement,
                pre_tax_deductions:      r.preTaxDeductions,
                deduction_401k:          r.deduction401k,
                deduction_medical:       r.deductionMedical,
                federal_income_tax:      r.taxes.federalIncomeTax,
                social_security:         r.taxes.socialSecurity,
                medicare:                r.taxes.medicare,
                state_income_tax:        r.taxes.stateIncomeTax,
                total_employee_taxes:    r.taxes.totalEmployeeTaxes,
                post_tax_deductions:     r.postTaxDeductions,
                garnishment_deductions:  r.garnishmentDeductions,
                pay_advance_deduction:   r.payAdvanceDeduction,
                net_pay:                 r.netPay,
                net_pay_checking:        r.netPayChecking,
                net_pay_savings:         r.netPaySavings,
                employer_social_security:r.employerTaxes.socialSecurity,
                employer_medicare:       r.employerTaxes.medicare,
                futa:                    r.employerTaxes.futa,
                suta:                    r.employerTaxes.suta,
                total_employer_taxes:    r.totalEmployerTaxes,
                total_payroll_cost:      r.totalPayrollCost,
            };
        });

        _check(
            await _sb.from('payroll_line_items').insert(lineItems),
            'savePayrollRun → lineItems'
        );

        await this.addAuditLog(
            'Payroll Processed',
            `Processed run for ${runSummary.employeeCount} employees. Total: $${runSummary.totalCost.toFixed(2)}`,
            'payroll'
        );

        return run.id;
    },

    /**
     * Get YTD gross for a specific employee (sum of all completed run gross pays).
     * Used by the payroll engine for FICA/FUTA wage-cap calculations.
     */
    async getYTDGross(employeeId) {
        const year = new Date().getFullYear();
        const { data } = await _sb.from('payroll_line_items')
            .select('gross_pay, payroll_runs!inner(run_date, status)')
            .eq('employee_id', employeeId)
            .eq('payroll_runs.status', 'completed')
            .gte('payroll_runs.run_date', `${year}-01-01`);

        return (data || []).reduce((sum, li) => sum + parseFloat(li.gross_pay), 0);
    },

    // ─────────────────────────────────────────
    // GARNISHMENTS
    // ─────────────────────────────────────────

    /** Return all active garnishments for the current company. */
    async getGarnishments() {
        const rows = _check(
            await _sb.from('garnishments').select('*').eq('is_active', true),
            'getGarnishments'
        );
        return rows.map(g => ({
            id:          g.id,
            employeeId:  g.employee_id,
            caseNumber:  g.case_number,
            type:        g.type,
            amount:      parseFloat(g.amount),
            limit:       g.limit_amount ? parseFloat(g.limit_amount) : undefined,
            ytdDeducted: parseFloat(g.ytd_deducted),
        }));
    },

    /** Add a garnishment to an employee. */
    async addGarnishment(employeeId, garn) {
        const company = await this.getCompany();
        const row = _check(
            await _sb.from('garnishments').insert({
                company_id:   company.id,
                employee_id:  employeeId,
                case_number:  garn.caseNumber,
                type:         garn.type,
                amount:       garn.amount,
                limit_amount: garn.limit || null,
                ytd_deducted: 0,
            }).select().single(),
            'addGarnishment'
        );

        await this.addAuditLog(
            'Garnishment Added',
            `Added ${garn.type} (Case: ${garn.caseNumber}) of $${garn.amount}/run`,
            'employee'
        );

        return row.id;
    },

    /** Remove a garnishment (soft delete). */
    async deleteGarnishment(garnId) {
        _check(
            await _sb.from('garnishments').update({ is_active: false }).eq('id', garnId),
            'deleteGarnishment'
        );
        await this.addAuditLog('Garnishment Removed', `Removed garnishment ${garnId}`, 'employee');
    },

    /** Update ytd_deducted on garnishments after a payroll run. */
    async updateGarnishmentYTD(garnId, additionalAmount) {
        const { data: existing } = await _sb.from('garnishments').select('ytd_deducted').eq('id', garnId).single();
        const newYTD = (parseFloat(existing?.ytd_deducted) || 0) + additionalAmount;
        await _sb.from('garnishments').update({ ytd_deducted: newYTD }).eq('id', garnId);
    },

    // ─────────────────────────────────────────
    // PAY ADVANCES
    // ─────────────────────────────────────────

    /** Return all pay advances for the current company. */
    async getPayAdvances() {
        const rows = _check(
            await _sb.from('pay_advances').select('*').order('created_at', { ascending: false }),
            'getPayAdvances'
        );
        return rows.map(a => ({
            id:           a.id,
            empId:        a.employee_id,
            amount:       parseFloat(a.amount),
            status:       a.status,
            requestDate:  a.request_date,
            approvedDate: a.approved_date,
            repaidDate:   a.repaid_date,
            payrollRunId: a.payroll_run_id,
        }));
    },

    /** Submit a pay advance request from an employee. */
    async requestPayAdvance(employeeId, amount) {
        const company = await this.getCompany();
        _check(
            await _sb.from('pay_advances').insert({
                company_id:   company.id,
                employee_id:  employeeId,
                amount:       amount,
                status:       'pending',
                request_date: new Date().toISOString().slice(0, 10),
            }),
            'requestPayAdvance'
        );
    },

    /** Approve a pay advance request. */
    async approvePayAdvance(advId) {
        _check(
            await _sb.from('pay_advances').update({
                status:        'approved',
                approved_date: new Date().toISOString().slice(0, 10),
            }).eq('id', advId),
            'approvePayAdvance'
        );
        await this.addAuditLog('Pay Advance Approved', `Approved advance ${advId}`, 'payroll');
    },

    /** Deny a pay advance request. */
    async denyPayAdvance(advId) {
        _check(
            await _sb.from('pay_advances').update({ status: 'denied' }).eq('id', advId),
            'denyPayAdvance'
        );
    },

    /** Mark an advance as repaid after a payroll run. */
    async repayPayAdvance(advId, payrollRunId) {
        _check(
            await _sb.from('pay_advances').update({
                status:       'repaid',
                repaid_date:  new Date().toISOString().slice(0, 10),
                payroll_run_id: payrollRunId,
            }).eq('id', advId),
            'repayPayAdvance'
        );
    },

    // ─────────────────────────────────────────
    // PTO
    // ─────────────────────────────────────────

    /** Return PTO balances for all employees as { empId: { vacation, sick, personal } }. */
    async getPTOBalances() {
        const rows = _check(
            await _sb.from('pto_balances').select('*'),
            'getPTOBalances'
        );
        const map = {};
        rows.forEach(r => {
            map[r.employee_id] = {
                vacation: parseFloat(r.vacation_hours),
                sick:     parseFloat(r.sick_hours),
                personal: parseFloat(r.personal_hours),
            };
        });
        return map;
    },

    /** Update PTO balance for one employee. */
    async updatePTOBalance(employeeId, balances) {
        _check(
            await _sb.from('pto_balances').upsert({
                employee_id:    employeeId,
                vacation_hours: balances.vacation,
                sick_hours:     balances.sick,
                personal_hours: balances.personal,
            }, { onConflict: 'employee_id' }),
            'updatePTOBalance'
        );
    },

    /** Return all PTO requests for the current company. */
    async getPTORequests() {
        const rows = _check(
            await _sb.from('pto_requests').select('*').order('created_at', { ascending: false }),
            'getPTORequests'
        );
        return rows.map(r => ({
            id:          r.id,
            empId:       r.employee_id,
            type:        r.type,
            startDate:   r.start_date,
            endDate:     r.end_date,
            hours:       parseFloat(r.hours),
            status:      r.status,
            reason:      r.reason,
            requestDate: r.request_date,
        }));
    },

    /** Submit a PTO request. */
    async requestPTO(employeeId, req) {
        const company = await this.getCompany();
        _check(
            await _sb.from('pto_requests').insert({
                company_id:   company.id,
                employee_id:  employeeId,
                type:         req.type,
                start_date:   req.startDate,
                end_date:     req.endDate,
                hours:        req.hours,
                reason:       req.reason || '',
                request_date: new Date().toISOString().slice(0, 10),
            }),
            'requestPTO'
        );
    },

    /** Approve or deny a PTO request. */
    async updatePTOStatus(reqId, status) {
        _check(
            await _sb.from('pto_requests').update({ status }).eq('id', reqId),
            'updatePTOStatus'
        );
    },

    // ─────────────────────────────────────────
    // BENEFITS
    // ─────────────────────────────────────────

    /** Return benefits as { empId: { healthPlan, dental, vision, lifeInsurance, fsa } }. */
    async getBenefits() {
        const rows = _check(
            await _sb.from('benefits').select('*'),
            'getBenefits'
        );
        const map = {};
        rows.forEach(r => {
            map[r.employee_id] = {
                healthPlan:    r.health_plan,
                dental:        r.dental,
                vision:        r.vision,
                lifeInsurance: r.life_insurance,
                fsa:           parseFloat(r.fsa),
            };
        });
        return map;
    },

    /** Update benefits for an employee. */
    async updateBenefits(employeeId, b) {
        _check(
            await _sb.from('benefits').upsert({
                employee_id:   employeeId,
                health_plan:   b.healthPlan,
                dental:        b.dental,
                vision:        b.vision,
                life_insurance: b.lifeInsurance,
                fsa:           b.fsa,
            }, { onConflict: 'employee_id' }),
            'updateBenefits'
        );
    },

    // ─────────────────────────────────────────
    // ANNOUNCEMENTS
    // ─────────────────────────────────────────

    /** Return all announcements for the current company, newest first. */
    async getAnnouncements() {
        const rows = _check(
            await _sb.from('announcements').select('*').order('created_at', { ascending: false }),
            'getAnnouncements'
        );
        return rows.map(r => ({
            id:       r.id,
            title:    r.title,
            body:     r.body,
            priority: r.priority,
            author:   r.author,
            date:     new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        }));
    },

    /** Post a new announcement. */
    async addAnnouncement(ann) {
        const company = await this.getCompany();
        const user    = await this.getUser();
        _check(
            await _sb.from('announcements').insert({
                company_id: company.id,
                title:      ann.title,
                body:       ann.body,
                priority:   ann.priority || 'info',
                author:     ann.author || user.email,
            }),
            'addAnnouncement'
        );
    },

    // ─────────────────────────────────────────
    // AUDIT LOG
    // ─────────────────────────────────────────

    /** Return the audit log for the current company, newest first. */
    async getAuditLog() {
        const rows = _check(
            await _sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
            'getAuditLog'
        );
        return rows.map(r => ({
            id:       r.id,
            ts:       new Date(r.created_at).toLocaleString(),
            action:   r.action,
            actor:    r.actor_label || 'system',
            details:  r.details,
            category: r.category,
        }));
    },

    /** Append an entry to the audit log. Called internally by other methods. */
    async addAuditLog(action, details, category = 'settings') {
        const company = await this.getCompany();
        const user    = await this.getUser();
        await _sb.from('audit_log').insert({
            company_id:  company.id,
            actor_id:    user?.id    || null,
            actor_label: user?.email || 'system',
            action,
            details,
            category,
        });
    },

    // ─────────────────────────────────────────
    // ONBOARDING
    // ─────────────────────────────────────────

    /** Return the onboarding queue for the current company. */
    async getOnboardingQueue() {
        const rows = _check(
            await _sb.from('onboarding_queue').select('*').order('created_at', { ascending: false }),
            'getOnboardingQueue'
        );
        return rows.map(r => ({
            id:          r.id,
            name:        r.name,
            email:       r.email,
            role:        r.role,
            department:  r.department,
            startDate:   r.start_date ? new Date(r.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
            status:      r.status,
            step:        r.step,
            totalSteps:  r.total_steps,
        }));
    },

    /** Add a new hire to the onboarding queue. */
    async addToOnboarding(hire) {
        const company = await this.getCompany();
        _check(
            await _sb.from('onboarding_queue').insert({
                company_id:  company.id,
                name:        hire.name,
                email:       hire.email,
                role:        hire.role,
                department:  hire.department,
                start_date:  hire.startDate,
                status:      'pending-docs',
                step:        1,
                total_steps: 5,
            }),
            'addToOnboarding'
        );
    },

    /** Advance or update a hire's onboarding step/status. */
    async updateOnboardingStatus(id, fields) {
        _check(
            await _sb.from('onboarding_queue').update({
                status: fields.status,
                step:   fields.step,
            }).eq('id', id),
            'updateOnboardingStatus'
        );
    },

    // ─────────────────────────────────────────
    // INTEGRATIONS
    // ─────────────────────────────────────────

    /** Return integration settings for the current company. */
    async getIntegrations() {
        const { data } = await _sb.from('integrations').select('*').maybeSingle();
        return {
            quickbooks: data?.quickbooks_enabled || false,
            xero:       data?.xero_enabled       || false,
        };
    },

    /** Toggle QuickBooks or Xero on/off. name = 'quickbooks' | 'xero' */
    async toggleIntegration(name) {
        const current = await this.getIntegrations();
        const field   = name === 'quickbooks' ? 'quickbooks_enabled' : 'xero_enabled';
        const company = await this.getCompany();

        _check(
            await _sb.from('integrations').upsert({
                company_id: company.id,
                [field]:    !current[name],
            }, { onConflict: 'company_id' }),
            'toggleIntegration'
        );
        await this.addAuditLog(
            `Integration ${!current[name] ? 'Connected' : 'Disconnected'}`,
            `${name} integration ${!current[name] ? 'enabled' : 'disabled'}`,
            'integration'
        );
    },

    // ─────────────────────────────────────────
    // SYNC LOGS
    // ─────────────────────────────────────────

    /** Return sync logs for the current company, newest first. */
    async getSyncLogs() {
        const rows = _check(
            await _sb.from('sync_logs').select('*').order('created_at', { ascending: false }).limit(50),
            'getSyncLogs'
        );
        return rows.map(r => ({
            id:      r.id,
            date:    new Date(r.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            type:    r.type === 'quickbooks' ? 'QuickBooks' : 'Xero',
            details: r.details,
            debit:   parseFloat(r.debit),
            credit:  parseFloat(r.credit),
            status:  r.status,
        }));
    },

    /** Append a sync log entry after a payroll run syncs to accounting. */
    async addSyncLog(type, details, amount, payrollRunId) {
        const company = await this.getCompany();
        _check(
            await _sb.from('sync_logs').insert({
                company_id:      company.id,
                type:            type.toLowerCase(),
                details,
                debit:           amount,
                credit:          amount,
                status:          'success',
                payroll_run_id:  payrollRunId,
            }),
            'addSyncLog'
        );
    },

    /** Return confirmed filing records for the current company, newest first. */
    async getFilingRecords() {
        const { data } = await _sb.from('filing_records')
            .select('*')
            .order('filed_at', { ascending: false });
        return (data || []).map(r => ({
            id:          r.id,
            form_type:   r.form_type,
            form_ref:    r.form_type + '-' + r.period.replace(/\s/g, '-'),
            period:      r.period,
            agency:      r.agency,
            amount_due:  parseFloat(r.amount_due),
            amount_paid: parseFloat(r.amount_paid),
            status:      r.status,
            filed_at:    r.filed_at,
            actor_label: r.actor_label || 'Admin',
        }));
    },

    // ─────────────────────────────────────────
    // TAX E-FILE (third-party provider transmission)
    // ─────────────────────────────────────────

    /** Return e-file submissions for the current company, keyed by form_ref. */
    async getTaxFilings() {
        const { data } = await _sb.from('tax_filing_submissions')
            .select('*')
            .order('updated_at', { ascending: false });
        return (data || []).map(r => ({
            id:                     r.id,
            form_ref:               r.form_ref,
            form_type:              r.form_type,
            period:                 r.period,
            agency:                 r.agency,
            amount:                 parseFloat(r.amount),
            provider:               r.provider,
            provider_submission_id: r.provider_submission_id,
            status:                 r.status,
            status_detail:          r.status_detail,
            submitted_at:           r.submitted_at,
            updated_at:             r.updated_at,
        }));
    },

    /** Authenticated POST to the file-tax edge function. */
    async _invokeFileTax(payload) {
        const url = (typeof AeroConfig !== 'undefined' && AeroConfig.fileTaxFunctionUrl) || '';
        if (!url) throw new Error('E-file function URL is not configured.');
        const session = await _sb.auth.getSession();
        const token   = session.data?.session?.access_token;
        if (!token) throw new Error('You must be signed in to e-file.');

        const resp = await fetch(url, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await resp.json().catch(() => ({}));
        // A configured=false body means no provider is connected yet — surface it
        // to the caller rather than treating it as a hard failure.
        if (!resp.ok && data.configured !== false) {
            throw new Error(data.error || `E-file request failed (${resp.status})`);
        }
        return data;
    },

    /** Submit a filing to the e-file provider. Returns the provider response. */
    async submitEfile({ formRef, formType, period, agency, amount, formData }) {
        return this._invokeFileTax({
            action: 'submit',
            formRef, formType, period, agency,
            amount: amount || 0,
            formData: formData || {},
        });
    },

    /** Poll the provider for the latest status of a submission. */
    async getEfileStatus(submissionId) {
        return this._invokeFileTax({ action: 'get_status', submissionId });
    },

    // ─────────────────────────────────────────
    // W-2 SIGNATURES
    // ─────────────────────────────────────────

    /** Return the W-2 signature record for an employee, or null. */
    async getW2Signature(employeeId) {
        const year = new Date().getFullYear();
        const { data } = await _sb.from('w2_signatures')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('tax_year', year)
            .maybeSingle();

        if (!data) return null;
        return {
            employeeId:    data.employee_id,
            signatureData: data.signature_data,
            timestamp:     new Date(data.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            ipAddress:     data.ip_address,
        };
    },

    /** Save a W-2 digital signature. */
    async saveW2Signature(employeeId, signatureDataURL, ipAddress, userAgent) {
        const company = await this.getCompany();
        const year    = new Date().getFullYear();
        _check(
            await _sb.from('w2_signatures').upsert({
                company_id:     company.id,
                employee_id:    employeeId,
                tax_year:       year,
                signature_data: signatureDataURL,
                ip_address:     ipAddress,
                user_agent:     userAgent,
                signed_at:      new Date().toISOString(),
            }, { onConflict: 'employee_id,tax_year' }),
            'saveW2Signature'
        );
        await this.addAuditLog('W-2 Signed', `Employee ${employeeId} signed W-2 for ${year}`, 'employee');
    },

    // ─────────────────────────────────────────
    // FULL STATE LOADER
    // ─────────────────────────────────────────

    /**
     * Load the complete app state from Supabase in one coordinated fetch.
     * Returns an object in the same shape as DEFAULT_STATE in app.js,
     * so the existing render functions work without modification.
     */
    async loadFullState() {
        const [
            company,
            employees,
            payrollHistory,
            timesheetMap,
            ptoBalances,
            ptoRequests,
            benefits,
            announcements,
            auditLog,
            onboardingQueue,
            integrations,
            syncLogs,
            payAdvances,
            filingRecords,
            taxFilings,
        ] = await Promise.all([
            this.getCompany(),
            this.getEmployees(),
            this.getPayrollHistory(),
            this.getAllTimesheets(),
            this.getPTOBalances(),
            this.getPTORequests(),
            this.getBenefits(),
            this.getAnnouncements(),
            this.getAuditLog(),
            this.getOnboardingQueue(),
            this.getIntegrations(),
            this.getSyncLogs(),
            this.getPayAdvances(),
            this.getFilingRecords(),
            this.getTaxFilings(),
        ]);

        return {
            settings: {
                companyName:   company.name,
                ein:           company.ein           || '',
                bankName:      company.bankName       || '',
                routingNumber: company.routingNumber  || '',
                accountNumber: company.accountNumber  || '',
                paymentType:   company.paymentType    || 'direct_deposit',
            },
            employees,
            payrollHistory,
            timesheets:      timesheetMap,
            ptoBalances,
            ptoRequests,
            benefits,
            announcements,
            auditLog,
            onboardingQueue,
            integrations,
            syncLogs,
            payAdvances,
            filingRecords,
            taxFilings,
            garnishments:    [],   // attached per-employee inside getEmployees()
            w2Signatures:    {},   // fetched on-demand via getW2Signature()
            burnRateBudget:  { monthly: 45000 },
            splitDeposits:   {},
        };
    },
};

// ─────────────────────────────────────────────
// PRIVATE UTILITY
// ─────────────────────────────────────────────

/** Returns the ISO date string for Monday of the current week. */
function _getMondayOfCurrentWeek() {
    const d = new Date();
    const day = d.getDay(); // 0 = Sun
    const diff = (day === 0) ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}
