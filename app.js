/**
 * AeroPay Core Orchestrator & State Manager
 */

// Default Seed Data
const DEFAULT_STATE = {
    employees: [
        { id: "emp-101", name: "Sarah Jenkins", email: "sarah.j@company.com", role: "Software Architect", classification: "w2", type: "salaried", rate: 125000, payFrequency: "biweekly", filingStatus: "married", state: "CA", department: "Engineering", benefits: { rate401k: 4, medicalPremium: 80, reimbursement: 50 } },
        { id: "emp-102", name: "David Miller", email: "d.miller@company.com", role: "Marketing Lead", classification: "w2", type: "salaried", rate: 84000, payFrequency: "biweekly", filingStatus: "single", state: "NY", department: "Sales & Marketing", benefits: { rate401k: 3, medicalPremium: 80, reimbursement: 0 } },
        { id: "emp-103", name: "Elena Rostova", email: "e.rostova@company.com", role: "Customer Support Executive", classification: "w2", type: "hourly", rate: 28.50, payFrequency: "weekly", filingStatus: "single", state: "TX", department: "Customer Support", benefits: { rate401k: 0, medicalPremium: 40, reimbursement: 25 } },
        { id: "emp-104", name: "Marcus Brody", email: "m.brody@company.com", role: "UX Designer (Contractor)", classification: "1099", type: "hourly", rate: 45.00, payFrequency: "biweekly", filingStatus: "married", state: "FL", department: "Product Design", benefits: { rate401k: 0, medicalPremium: 0, reimbursement: 100 } }
    ],
    timesheets: {
        "emp-103": [8, 8, 8, 8, 8, 0, 0], // 40 hours standard
        "emp-104": [8, 9, 8, 10, 8, 0, 0] // 43 hours (3h OT)
    },
    payrollHistory: [
        {
            id: "run-001",
            date: "May 15, 2026",
            employeeCount: 4,
            grossPayroll: 10540.00,
            employerTaxes: 680.12,
            totalCost: 11370.12,
            details: {
                "emp-101": {
                    grossPay: 4807.69, regularEarnings: 4807.69, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 50,
                    preTaxDeductions: 272.31, deduction401k: 192.31, deductionMedical: 80, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 387.44, socialSecurity: 298.08, medicare: 69.71, stateIncomeTax: 142.20, totalEmployeeTaxes: 897.43 },
                    netPay: 3637.95,
                    employerTaxes: { socialSecurity: 298.08, medicare: 69.71, futa: 0, suta: 0, totalEmployerTaxes: 367.79 },
                    totalEmployerTaxes: 367.79, totalPayrollCost: 5225.48
                },
                "emp-102": {
                    grossPay: 3230.77, regularEarnings: 3230.77, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 0,
                    preTaxDeductions: 176.92, deduction401k: 96.92, deductionMedical: 80, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 280.12, socialSecurity: 200.31, medicare: 46.85, stateIncomeTax: 120.30, totalEmployeeTaxes: 647.58 },
                    netPay: 2368.50,
                    employerTaxes: { socialSecurity: 200.31, medicare: 46.85, futa: 0, suta: 0, totalEmployerTaxes: 247.16 },
                    totalEmployerTaxes: 247.16, totalPayrollCost: 3477.93
                },
                "emp-103": {
                    grossPay: 912.00, regularEarnings: 912.00, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 25,
                    preTaxDeductions: 0, deduction401k: 0, deductionMedical: 40, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 70.12, socialSecurity: 56.54, medicare: 13.22, stateIncomeTax: 0, totalEmployeeTaxes: 139.88 },
                    netPay: 757.12,
                    employerTaxes: { socialSecurity: 56.54, medicare: 13.22, futa: 0, suta: 0, totalEmployerTaxes: 69.76 },
                    totalEmployerTaxes: 69.76, totalPayrollCost: 1006.76
                },
                "emp-104": {
                    grossPay: 1589.54, regularEarnings: 1589.54, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 75,
                    preTaxDeductions: 0, deduction401k: 0, deductionMedical: 0, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 0, socialSecurity: 0, medicare: 0, stateIncomeTax: 0, totalEmployeeTaxes: 0 },
                    netPay: 1664.54,
                    employerTaxes: { socialSecurity: 0, medicare: 0, futa: 0, suta: 0, totalEmployerTaxes: 0 },
                    totalEmployerTaxes: 0, totalPayrollCost: 1664.54
                }
            }
        },
        {
            id: "run-002",
            date: "May 30, 2026",
            employeeCount: 4,
            grossPayroll: 10835.96,
            employerTaxes: 691.26,
            totalCost: 11702.22,
            details: {
                "emp-101": {
                    grossPay: 4807.69, regularEarnings: 4807.69, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 50,
                    preTaxDeductions: 272.31, deduction401k: 192.31, deductionMedical: 80, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 387.44, socialSecurity: 298.08, medicare: 69.71, stateIncomeTax: 142.20, totalEmployeeTaxes: 897.43 },
                    netPay: 3637.95,
                    employerTaxes: { socialSecurity: 298.08, medicare: 69.71, futa: 0, suta: 0, totalEmployerTaxes: 367.79 },
                    totalEmployerTaxes: 367.79, totalPayrollCost: 5225.48
                },
                "emp-102": {
                    grossPay: 3230.77, regularEarnings: 3230.77, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 0,
                    preTaxDeductions: 176.92, deduction401k: 96.92, deductionMedical: 80, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 280.12, socialSecurity: 200.31, medicare: 46.85, stateIncomeTax: 120.30, totalEmployeeTaxes: 647.58 },
                    netPay: 2368.50,
                    employerTaxes: { socialSecurity: 200.31, medicare: 46.85, futa: 0, suta: 0, totalEmployerTaxes: 247.16 },
                    totalEmployerTaxes: 247.16, totalPayrollCost: 3477.93
                },
                "emp-103": {
                    grossPay: 997.50, regularEarnings: 997.50, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 25,
                    preTaxDeductions: 0, deduction401k: 0, deductionMedical: 40, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 77.21, socialSecurity: 61.85, medicare: 14.46, stateIncomeTax: 0, totalEmployeeTaxes: 153.52 },
                    netPay: 934.34,
                    employerTaxes: { socialSecurity: 61.85, medicare: 14.46, futa: 0, suta: 0, totalEmployerTaxes: 76.31 },
                    totalEmployerTaxes: 76.31, totalPayrollCost: 1098.81
                },
                "emp-104": {
                    grossPay: 1800.00, regularEarnings: 1800.00, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 100,
                    preTaxDeductions: 0, deduction401k: 0, deductionMedical: 0, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 0, socialSecurity: 0, medicare: 0, stateIncomeTax: 0, totalEmployeeTaxes: 0 },
                    netPay: 1900.00,
                    employerTaxes: { socialSecurity: 0, medicare: 0, futa: 0, suta: 0, totalEmployerTaxes: 0 },
                    totalEmployerTaxes: 0, totalPayrollCost: 1900.00
                }
            }
        },
        {
            id: "run-003",
            date: "June 10, 2026",
            employeeCount: 4,
            grossPayroll: 11263.46,
            employerTaxes: 702.16,
            totalCost: 12115.62,
            details: {
                "emp-101": {
                    grossPay: 4807.69, regularEarnings: 4807.69, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 50,
                    preTaxDeductions: 272.31, deduction401k: 192.31, deductionMedical: 80, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 387.44, socialSecurity: 298.08, medicare: 69.71, stateIncomeTax: 142.20, totalEmployeeTaxes: 897.43 },
                    netPay: 3637.95,
                    employerTaxes: { socialSecurity: 298.08, medicare: 69.71, futa: 0, suta: 0, totalEmployerTaxes: 367.79 },
                    totalEmployerTaxes: 367.79, totalPayrollCost: 5225.48
                },
                "emp-102": {
                    grossPay: 3230.77, regularEarnings: 3230.77, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 0,
                    preTaxDeductions: 176.92, deduction401k: 96.92, deductionMedical: 80, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 280.12, socialSecurity: 200.31, medicare: 46.85, stateIncomeTax: 120.30, totalEmployeeTaxes: 647.58 },
                    netPay: 2368.50,
                    employerTaxes: { socialSecurity: 200.31, medicare: 46.85, futa: 0, suta: 0, totalEmployerTaxes: 247.16 },
                    totalEmployerTaxes: 247.16, totalPayrollCost: 3477.93
                },
                "emp-103": {
                    grossPay: 1140.00, regularEarnings: 1140.00, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 25,
                    preTaxDeductions: 0, deduction401k: 0, deductionMedical: 40, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 97.60, socialSecurity: 70.68, medicare: 16.53, stateIncomeTax: 0, totalEmployeeTaxes: 184.81 },
                    netPay: 980.19,
                    employerTaxes: { socialSecurity: 70.68, medicare: 16.53, futa: 0, suta: 0, totalEmployerTaxes: 87.21 },
                    totalEmployerTaxes: 87.21, totalPayrollCost: 1252.21
                },
                "emp-104": {
                    grossPay: 2085.00, regularEarnings: 2085.00, overtimeEarnings: 0, bonus: 0, commissions: 0, reimbursement: 75,
                    preTaxDeductions: 0, deduction401k: 0, deductionMedical: 0, postTaxDeductions: 0,
                    taxes: { federalIncomeTax: 0, socialSecurity: 0, medicare: 0, stateIncomeTax: 0, totalEmployeeTaxes: 0 },
                    netPay: 2160.00,
                    employerTaxes: { socialSecurity: 0, medicare: 0, futa: 0, suta: 0, totalEmployerTaxes: 0 },
                    totalEmployerTaxes: 0, totalPayrollCost: 2160.00
                }
            }
        }
    ],
    integrations: {
        quickbooks: true,
        xero: false
    },
    syncLogs: [
        { date: "June 10, 2026", type: "QuickBooks", details: "Synced Period Ending 06/10 Gross: $11,263.46 / FICA: $702.16", debit: 12115.62, credit: 12115.62, status: "Success" },
        { date: "May 30, 2026", type: "QuickBooks", details: "Synced Period Ending 05/30 Gross: $10,835.96 / FICA: $691.26", debit: 11702.22, credit: 11702.22, status: "Success" }
    ],
    settings: {
        companyName: "Zenith Tech Solutions Inc.",
        ein: "12-3456789",
        bankName: "Chase Bank Business Select",
        routingNumber: "021000021",
        accountNumber: "••••••••9820",
        paymentType: "direct_deposit"
    },
    w2Signatures: {},
    ptoBalances: {
        "emp-101": { vacation: 120, sick: 64, personal: 24 },
        "emp-102": { vacation: 80, sick: 40, personal: 16 },
        "emp-103": { vacation: 64, sick: 48, personal: 8 }
    },
    ptoRequests: [
        { id: "pto-001", empId: "emp-103", type: "vacation", startDate: "2026-07-04", endDate: "2026-07-07", hours: 32, status: "pending", reason: "Independence Day holiday trip", requestDate: "June 10, 2026" }
    ],
    announcements: [
        { id: "ann-001", title: "Q2 Payroll Schedule Update", body: "Payroll for the July 4th holiday week will process on Thursday July 3rd. Direct deposits will arrive by July 5th.", date: "June 10, 2026", priority: "info", author: "HR Admin" },
        { id: "ann-002", title: "Benefits Open Enrollment — July 1", body: "Annual open enrollment begins July 1st. You have 30 days to review and update your health, dental, and vision plan elections for 2026.", date: "June 8, 2026", priority: "warning", author: "Benefits Team" }
    ],
    auditLog: [
        { id: "aud-001", ts: "2026-06-10 09:45 AM", action: "Payroll Processed", actor: "admin@zenith.com", details: "Processed run-003 for 4 employees. Total: $12,115.62", category: "payroll" },
        { id: "aud-002", ts: "2026-06-10 09:30 AM", action: "Payroll Submitted for Approval", actor: "admin@zenith.com", details: "Payroll run-003 submitted for approval", category: "payroll" },
        { id: "aud-003", ts: "2026-06-08 02:30 PM", action: "Employee Updated", actor: "admin@zenith.com", details: "Marcus Brody reimbursement rate updated", category: "employee" },
        { id: "aud-004", ts: "2026-06-05 11:15 AM", action: "Integration Synced", actor: "system", details: "QuickBooks sync completed for run-002. 12 journal entries created.", category: "integration" },
        { id: "aud-005", ts: "2026-06-01 08:00 AM", action: "Settings Updated", actor: "admin@zenith.com", details: "Company EIN and bank routing number updated", category: "settings" }
    ],
    benefits: {
        "emp-101": { healthPlan: "gold",   dental: true,  vision: true,  lifeInsurance: true,  fsa: 200 },
        "emp-102": { healthPlan: "silver",  dental: true,  vision: false, lifeInsurance: false, fsa: 0 },
        "emp-103": { healthPlan: "bronze",  dental: false, vision: false, lifeInsurance: false, fsa: 0 }
    },
    garnishments: [],
    payAdvances: [],
    payrollApprovals: [
        { id: "appr-001", runId: "run-003", status: "approved", submittedBy: "admin@zenith.com", approvedBy: "admin@zenith.com", submittedTs: "2026-06-10 09:30 AM", approvedTs: "2026-06-10 09:45 AM", totalAmount: 12115.62, employeeCount: 4 },
        { id: "appr-002", runId: "run-002", status: "approved", submittedBy: "admin@zenith.com", approvedBy: "admin@zenith.com", submittedTs: "2026-05-30 10:00 AM", approvedTs: "2026-05-30 10:15 AM", totalAmount: 11702.22, employeeCount: 4 }
    ],
    onboardingQueue: [
        { id: "onb-001", name: "Alex Rivera", email: "a.rivera@company.com", role: "Backend Engineer", department: "Engineering", startDate: "July 1, 2026", status: "in-progress", step: 3, totalSteps: 5 },
        { id: "onb-002", name: "Priya Nair", email: "p.nair@company.com", role: "Product Manager", department: "Product Design", startDate: "July 15, 2026", status: "pending-docs", step: 1, totalSteps: 5 }
    ],
    burnRateBudget: { monthly: 45000 },
    splitDeposits: {}
};

const AeroApp = {
    state: {},
    currentView: 'landing',
    currentWizardStep: 1,
    activeRunData: {}, // Calculation outputs for step 2 review
    session: null,
    
    init: async function() {
        this.bindEvents();
        this.setupStep = 1;
        this.navigateTo('landing');

        AeroDB.onAuthChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this._loadStateAndNavigate();
            } else if (event === 'SIGNED_OUT') {
                this.state = {};
                this.session = null;
                this.navigateTo('landing');
            }
        });

        const user = await AeroDB.getUser();
        if (user) await this._loadStateAndNavigate();
    },

    _loadStateAndNavigate: async function() {
        try {
            this.state = await AeroDB.loadFullState();
            const user = await AeroDB.getUser();
            const empRecord = this.state.employees.find(e => e.userId === user.id);

            if (empRecord) {
                this.session = {
                    isLoggedIn: true,
                    role: 'employee',
                    employeeId: empRecord.id,
                    userName: empRecord.name,
                    userRole: empRecord.role,
                };
                this.navigateTo('employee-dashboard');
            } else {
                this.session = {
                    isLoggedIn: true,
                    role: 'company',
                    userName: user.email,
                    userRole: 'Administrator',
                };
                const isNewCompany = !this.state.settings?.setupComplete &&
                    this.state.employees.length === 0 &&
                    this.state.payrollHistory.length === 0 &&
                    !this.state.settings?.bankName;
                if (isNewCompany) {
                    this.setupStep = 1;
                    this.navigateTo('setup');
                } else {
                    this.navigateTo('dashboard');
                }
            }
            this.populateW2Selectors();
            if (typeof AeroBilling !== 'undefined') {
                AeroBilling.renderBillingBanner();
                AeroBilling.handleCheckoutReturn();
            }
        } catch (err) {
            console.error('[AeroApp] Failed to load state:', err);
            this.showToast('Failed to load company data. Please refresh.', 'danger');
        }
    },

    _refreshState: async function() {
        try {
            this.state = await AeroDB.loadFullState();
            this.navigateTo(this.currentView || 'dashboard');
        } catch (err) {
            console.error('[AeroApp] State refresh failed:', err);
        }
    },

    saveStateToStorage: function() {}, // no-op — all persistence via AeroDB

    // ─── Setup Wizard ────────────────────────────────────────────
    setupGoTo: function(step) {
        this.setupStep = step;
        this.navigateTo('setup');
    },

    setupNext: async function(e, step) {
        e.preventDefault();
        if (step === 1) {
            const name = document.getElementById('setupCompanyName').value.trim();
            const ein  = document.getElementById('setupEin').value.trim();
            try {
                await AeroDB.saveCompany({ companyName: name, ein, bankName: this.state.settings?.bankName || '', routingNumber: this.state.settings?.routingNumber || '', accountNumber: this.state.settings?.accountNumber || '', paymentType: 'direct_deposit' });
                this.state.settings = { ...this.state.settings, companyName: name, ein };
                this.showToast('Company profile saved!', 'success');
                this.setupGoTo(2);
            } catch (err) { this.showToast('Failed to save: ' + err.message, 'danger'); }
        } else if (step === 3) {
            const bankName = document.getElementById('setupBankName').value.trim();
            const routingNumber = document.getElementById('setupRouting').value.trim();
            const accountNumber = document.getElementById('setupAccount').value.trim();
            if (routingNumber.length !== 9 || !/^\d+$/.test(routingNumber)) { this.showToast('Routing number must be exactly 9 digits.', 'warning'); return; }
            try {
                await AeroDB.saveCompany({ companyName: this.state.settings?.companyName || '', ein: this.state.settings?.ein || '', bankName, routingNumber, accountNumber, paymentType: 'direct_deposit' });
                this.state.settings = { ...this.state.settings, bankName, routingNumber, accountNumber };
                this.showToast('Bank details saved!', 'success');
                this.setupGoTo(4);
            } catch (err) { this.showToast('Failed to save: ' + err.message, 'danger'); }
        }
    },

    openAddEmployeeModal: function() { this.openModal('addEmployee'); },

    completeSetup: async function(destination) {
        try {
            const company = await AeroDB.getCompany();
            await _sb.from('companies').update({ setup_complete: true }).eq('id', company.id);
            this.state.settings.setupComplete = true;
            await AeroDB.addAuditLog('Setup Completed', 'First-run setup wizard completed', 'settings');
            this.showToast('Setup complete — welcome to AeroPay! 🎉', 'success');
        } catch (_) {}
        this.navigateTo(destination === 'payroll' ? 'payroll' : 'dashboard');
    },

    bindEvents: function() {
        // Sidebar Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetView = link.getAttribute('data-view');
                if (targetView) {
                    this.navigateTo(targetView);
                }
            });
        });

        // Theme Toggle Button
        document.querySelector('.theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Modal Close Button
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });
    },

    navigateTo: function(viewName) {
        // Enforce guest state limits
        if (viewName !== 'landing' && (!this.session || !this.session.isLoggedIn)) {
            viewName = 'landing';
        }
        
        this.currentView = viewName;
        
        // Update Sidebar Active state
        document.querySelectorAll('.nav-item').forEach(item => {
            const link = item.querySelector('.nav-link');
            if (link.getAttribute('data-view') === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update body class depending on route and session
        if (viewName === 'landing' || viewName === 'setup') {
            document.body.className = 'guest-mode';
        } else if (this.session && this.session.role === 'employee') {
            document.body.className = 'employee-mode';
        } else {
            document.body.className = 'admin-mode';
        }

        // Update top header title & subtitle (only matters if header is visible)
        const titleEl = document.getElementById('topHeaderTitle');
        const subtitleEl = document.getElementById('topHeaderSubtitle');
        
        let titleText = "Dashboard";
        let subtitleText = "Overview of your payroll expenses & schedule";
        let htmlContent = "";

        switch (viewName) {
            case 'setup':
                titleText = 'Account Setup';
                subtitleText = '';
                htmlContent = renderSetupWizardView(this.state, this.setupStep || 1);
                break;
            case 'landing':
                titleText = "Welcome to AeroPay";
                subtitleText = "Autonomous Payroll & Tax Engine";
                htmlContent = renderLandingPageView(this.state);
                break;
            case 'employee-dashboard':
                const empForDash = this.state.employees.find(e => e.id === this.session.employeeId);
                if (empForDash && empForDash.classification === '1099') {
                    titleText = "Contractor Portal";
                    subtitleText = "Review invoices, payments, tax files, and track project hours";
                    htmlContent = renderContractorDashboardView(this.state, this.session.employeeId);
                } else {
                    titleText = "Employee Self-Service";
                    subtitleText = "Review pay statements, tax documents, and log hours";
                    htmlContent = renderEmployeeDashboardView(this.state, this.session.employeeId);
                }
                break;
            case 'employee-timecard':
                titleText = "My Weekly Time Card";
                subtitleText = "Record and review your logged work hours";
                htmlContent = renderEmployeeTimecardView(this.state, this.session.employeeId);
                break;
            case 'employee-documents':
                titleText = "Documents & Tax Forms";
                subtitleText = "Historical W-2s, withholding allowances, and onboarding archives";
                htmlContent = renderEmployeeDocumentsView(this.state, this.session.employeeId);
                break;
            case 'dashboard':
                titleText = "Payroll Dashboard";
                subtitleText = "Real-time cost trackers and next payday schedules";
                htmlContent = renderDashboardView(this.state);
                break;
            case 'employees':
                titleText = "Employees";
                subtitleText = "Direct staff contracts, rates, and state taxation residencies";
                htmlContent = renderEmployeesView(this.state);
                break;
            case 'payroll':
                titleText = "Run Payroll";
                subtitleText = "Execute periodic salary direct deposits and withhold tax allocations";
                htmlContent = renderRunPayrollView(this.state);
                break;
            case 'time-tracking':
                titleText = "Time Tracking";
                subtitleText = "Log hourly employee weekly sheets & calculate overtime";
                htmlContent = renderTimeTrackingView(this.state);
                break;
            case 'tax-compliance':
                titleText = "Tax Compliance Hub";
                subtitleText = "Review federal IRS Form 941 & annual employee W-2 files";
                htmlContent = renderTaxComplianceView(this.state);
                break;
            case 'integrations':
                titleText = "Integrations";
                subtitleText = "Map payroll accounts to QuickBooks Online or Xero ledgers";
                htmlContent = renderIntegrationsView(this.state);
                break;
            case 'settings':
                titleText = "Company Settings";
                subtitleText = "Update routing records, EINS, and payroll deposit preferences";
                htmlContent = renderSettingsView(this.state);
                break;
            case 'onboarding':
                titleText = "Employee Onboarding";
                subtitleText = "Manage new hire workflows and document collection";
                htmlContent = renderOnboardingView(this.state);
                break;
            case 'directory':
                titleText = "Employee Directory";
                subtitleText = "Search and browse your full team roster";
                htmlContent = renderDirectoryView(this.state);
                break;
            case 'pto-admin':
                titleText = "PTO & Leave Management";
                subtitleText = "Review balances, approve requests, and manage leave policies";
                htmlContent = renderPTOView(this.state);
                break;
            case 'benefits-admin':
                titleText = "Benefits Administration";
                subtitleText = "Manage employee health, dental, vision, and retirement enrollments";
                htmlContent = renderBenefitsAdminView(this.state);
                break;
            case 'approvals':
                titleText = "Payroll Approvals";
                subtitleText = "Review and approve submitted payroll runs";
                htmlContent = renderApprovalsView(this.state);
                break;
            case 'reports':
                titleText = "Reports & Analytics";
                subtitleText = "Build custom reports and export payroll data";
                htmlContent = renderReportsView(this.state);
                break;
            case 'announcements':
                titleText = "Announcements";
                subtitleText = "Broadcast company-wide news and HR updates";
                htmlContent = renderAnnouncementsView(this.state);
                break;
            case 'audit-log':
                titleText = "Audit Log";
                subtitleText = "Complete timestamped history of all system actions";
                htmlContent = renderAuditLogView(this.state);
                break;
            case 'employee-pto':
                titleText = "My Time Off";
                subtitleText = "View balances, submit requests, and track approved leave";
                htmlContent = renderEmployeePTOView(this.state, this.session.employeeId);
                break;
            case 'employee-benefits':
                titleText = "My Benefits";
                subtitleText = "Review your enrolled health, dental, vision, and retirement plans";
                htmlContent = renderEmployeeBenefitsView(this.state, this.session.employeeId);
                break;
            case 'employee-401k':
                titleText = "Retirement & 401k";
                subtitleText = "Track contributions, employer match, and projected retirement balance";
                htmlContent = renderEmployee401kView(this.state, this.session.employeeId);
                break;
        }

        if (titleEl) titleEl.textContent = titleText;
        if (subtitleEl) subtitleEl.textContent = subtitleText;
        
        // Render content
        document.getElementById('mainViewContent').innerHTML = htmlContent;

        // Run post-renders (like drawing charts or filling active table logs)
        this.postViewRender(viewName);
        this.updateSidebarProfile();
    },

    postViewRender: function(viewName) {
        if (viewName === 'dashboard') {
            renderSpendChart('spendHistoryChart', this.state.payrollHistory);
            renderHeadcountChart('headcountChart', this.state.payrollHistory);
            renderDeptSpendChart('deptSpendChart', this.state.employees, this.state.payrollHistory);
        }
        else if (viewName === 'payroll') {
            this.currentWizardStep = 1;
            this.wizardGoToStep(1);
        }
        else if (viewName === 'time-tracking') {
            this.populateTimesheetEmployeeSelect();
            this.loadEmployeeTimesheet();
        }
        else if (viewName === 'tax-compliance') {
            this.updateComplianceNumbers();
        }
        else if (viewName === 'integrations') {
            this.renderSyncLogs();
        }
        else if (viewName === 'employee-timecard') {
            this.calculateMyTimecardTotal();
        }
        else if (viewName === 'reports') {
            this.generateReport();
        }
        else if (viewName === 'employee-401k') {
            this.render401kChart();
        }
    },

    showToast: function(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <svg style="width:18px;height:18px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Modal Control
    openModal: function(title, contentHTML, isLarge = false) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBodyContent').innerHTML = contentHTML;
        
        const overlay = document.getElementById('modalOverlay');
        const modal = overlay.querySelector('.modal');
        
        if (isLarge) {
            modal.classList.add('modal-large');
        } else {
            modal.classList.remove('modal-large');
        }
        
        overlay.classList.add('active');
    },

    closeModal: function() {
        document.getElementById('modalOverlay').classList.remove('active');
    },

    // --- Employee Directory Handlers ---
    openAddEmployeeModal: function() {
        const body = `
            <form id="addEmployeeForm" onsubmit="AeroApp.handleAddEmployee(event)">
                <div class="form-grid">
                    <div class="form-group col-span-2">
                        <label for="newEmpName">Full Name</label>
                        <input type="text" class="form-control" id="newEmpName" required placeholder="e.g. Jane Doe">
                    </div>
                    <div class="form-group col-span-2">
                        <label for="newEmpEmail">Email Address</label>
                        <input type="email" class="form-control" id="newEmpEmail" required placeholder="e.g. jane@company.com">
                    </div>
                    <div class="form-group">
                        <label for="newEmpRole">Role / Title</label>
                        <input type="text" class="form-control" id="newEmpRole" required placeholder="e.g. Software Engineer">
                    </div>
                    <div class="form-group">
                        <label for="newEmpState">Tax Residence State</label>
                        <select class="form-control" id="newEmpState">
                            <option value="CA">California (CA)</option>
                            <option value="NY">New York (NY)</option>
                            <option value="TX">Texas (TX) - 0% SIT</option>
                            <option value="FL">Florida (FL) - 0% SIT</option>
                            <option value="CO">Colorado (CO)</option>
                            <option value="IL">Illinois (IL)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="newEmpDept">Department</label>
                        <select class="form-control" id="newEmpDept">
                            <option value="Engineering">Engineering</option>
                            <option value="Sales & Marketing">Sales & Marketing</option>
                            <option value="Customer Support">Customer Support</option>
                            <option value="Product Design">Product Design</option>
                            <option value="Operations & HR">Operations & HR</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="newEmpClass">Staff Classification</label>
                        <select class="form-control" id="newEmpClass" onchange="AeroApp.toggleClassificationFields(this, 'newEmp')">
                            <option value="w2">W-2 Employee</option>
                            <option value="1099">1099 Contractor</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="newEmpType">Compensation Type</label>
                        <select class="form-control" id="newEmpType" onchange="AeroApp.toggleRateLabels(this, 'newEmpRateLabel')">
                            <option value="salaried">Salaried / Flat Rate</option>
                            <option value="hourly">Hourly Basis</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="newEmpRate" id="newEmpRateLabel">Annual Salary ($)</label>
                        <input type="number" step="any" class="form-control" id="newEmpRate" required placeholder="e.g. 75000">
                    </div>
                    <div class="form-group">
                        <label for="newEmpFreq">Pay Frequency</label>
                        <select class="form-control" id="newEmpFreq">
                            <option value="biweekly">Biweekly (26 periods)</option>
                            <option value="weekly">Weekly (52 periods)</option>
                            <option value="semimonthly">Semimonthly (24 periods)</option>
                            <option value="monthly">Monthly (12 periods)</option>
                        </select>
                    </div>
                    <div class="form-group" id="newEmpFilingGroup">
                        <label for="newEmpFiling">W-4 Filing Status</label>
                        <select class="form-control" id="newEmpFiling">
                            <option value="single">Single</option>
                            <option value="married">Married Filing Jointly</option>
                        </select>
                    </div>
                    <div class="form-group col-span-2">
                        <label for="newEmpReimbursement">Travel / Expense Reimbursement ($ per run)</label>
                        <input type="number" step="any" class="form-control" id="newEmpReimbursement" value="0">
                    </div>
                </div>
                
                <div id="newEmpW2Fields" class="form-grid" style="margin-top:16px; padding-top:16px; border-top:1px dashed var(--border-color); display: grid;">
                    <h4 class="col-span-2" style="font-family:var(--font-heading); margin-bottom:8px;">W-2 Benefits Settings</h4>
                    <div class="form-group">
                        <label for="newEmp401k">Pre-tax 401(k) Rate (%)</label>
                        <input type="number" step="0.1" class="form-control" id="newEmp401k" value="4">
                    </div>
                    <div class="form-group">
                        <label for="newEmpMedical">Flat Health premium ($ per run)</label>
                        <input type="number" step="any" class="form-control" id="newEmpMedical" value="80">
                    </div>
                </div>
                
                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
                    <button type="button" class="btn btn-secondary" onclick="AeroApp.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Staff Record</button>
                </div>
            </form>
        `;
        this.openModal("Onboard New Staff Member", body);
    },

    toggleRateLabels: function(selectEl, labelId) {
        const label = document.getElementById(labelId);
        if (!label) return;
        if (selectEl.value === 'hourly') {
            label.textContent = "Hourly Pay Rate ($)";
        } else {
            label.textContent = "Annual Salary ($)";
        }
    },

    toggleClassificationFields: function(selectEl, prefix) {
        const w2Container = document.getElementById(prefix + 'W2Fields');
        const filingGroup = document.getElementById(prefix + 'FilingGroup');
        const label = document.getElementById(prefix + 'RateLabel');
        
        if (selectEl.value === '1099') {
            if (w2Container) w2Container.style.display = 'none';
            if (filingGroup) filingGroup.style.display = 'none';
            if (label) label.textContent = "Contractor Rate ($)";
        } else {
            if (w2Container) w2Container.style.display = 'grid';
            if (filingGroup) filingGroup.style.display = 'block';
            if (label) {
                const compTypeSelect = document.getElementById(prefix + 'Type') || document.getElementById(prefix + 'TypeSelect');
                const compType = compTypeSelect ? compTypeSelect.value : 'salaried';
                label.textContent = compType === 'hourly' ? "Hourly Pay Rate ($)" : "Annual Salary ($)";
            }
        }
    },

    handleAddEmployee: async function(e) {
        e.preventDefault();
        const is1099 = document.getElementById('newEmpClass').value === '1099';
        const newEmp = {
            name: document.getElementById('newEmpName').value,
            email: document.getElementById('newEmpEmail').value,
            role: document.getElementById('newEmpRole').value,
            state: document.getElementById('newEmpState').value,
            department: document.getElementById('newEmpDept').value,
            classification: document.getElementById('newEmpClass').value,
            type: document.getElementById('newEmpType').value,
            rate: parseFloat(document.getElementById('newEmpRate').value),
            payFrequency: document.getElementById('newEmpFreq').value,
            filingStatus: is1099 ? 'single' : document.getElementById('newEmpFiling').value,
            benefits: {
                rate401k: is1099 ? 0 : parseFloat(document.getElementById('newEmp401k').value) || 0,
                medicalPremium: is1099 ? 0 : parseFloat(document.getElementById('newEmpMedical').value) || 0,
                reimbursement: parseFloat(document.getElementById('newEmpReimbursement').value) || 0,
            },
        };
        try {
            const created = await AeroDB.addEmployee(newEmp);
            this.state.employees.push(created);
            this.closeModal();
            this.showToast(`Successfully onboarded ${newEmp.name}`, 'success');
            if (this.setupStep === 2) { this.setupGoTo(2); } else { this.navigateTo('employees'); }
            this.populateW2Selectors();
            if (typeof AeroBilling !== 'undefined') AeroBilling.updateSeatCount(this.state.employees.length);
        } catch (err) { this.showToast('Failed to save employee: ' + err.message, 'danger'); }
    },

    openEditEmployeeModal: function(id) {
        const emp = this.state.employees.find(e => e.id === id);
        if (!emp) return;
        
        const is1099 = emp.classification === '1099';
        const benefits = emp.benefits || { rate401k: 0, medicalPremium: 0, reimbursement: 0 };

        const body = `
            <form id="editEmployeeForm" onsubmit="AeroApp.handleEditEmployee(event, '${id}')">
                <div class="form-grid">
                    <div class="form-group col-span-2">
                        <label for="editEmpName">Full Name</label>
                        <input type="text" class="form-control" id="editEmpName" value="${emp.name}" required>
                    </div>
                    <div class="form-group col-span-2">
                        <label for="editEmpEmail">Email Address</label>
                        <input type="email" class="form-control" id="editEmpEmail" value="${emp.email}" required>
                    </div>
                    <div class="form-group">
                        <label for="editEmpRole">Role / Title</label>
                        <input type="text" class="form-control" id="editEmpRole" value="${emp.role}" required>
                    </div>
                    <div class="form-group">
                        <label for="editEmpState">Tax Residence State</label>
                        <select class="form-control" id="editEmpState">
                            <option value="CA" ${emp.state === 'CA' ? 'selected' : ''}>California (CA)</option>
                            <option value="NY" ${emp.state === 'NY' ? 'selected' : ''}>New York (NY)</option>
                            <option value="TX" ${emp.state === 'TX' ? 'selected' : ''}>Texas (TX) - 0% SIT</option>
                            <option value="FL" ${emp.state === 'FL' ? 'selected' : ''}>Florida (FL) - 0% SIT</option>
                            <option value="CO" ${emp.state === 'CO' ? 'selected' : ''}>Colorado (CO)</option>
                            <option value="IL" ${emp.state === 'IL' ? 'selected' : ''}>Illinois (IL)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editEmpDept">Department</label>
                        <select class="form-control" id="editEmpDept">
                            <option value="Engineering" ${emp.department === 'Engineering' ? 'selected' : ''}>Engineering</option>
                            <option value="Sales & Marketing" ${emp.department === 'Sales & Marketing' ? 'selected' : ''}>Sales & Marketing</option>
                            <option value="Customer Support" ${emp.department === 'Customer Support' ? 'selected' : ''}>Customer Support</option>
                            <option value="Product Design" ${emp.department === 'Product Design' ? 'selected' : ''}>Product Design</option>
                            <option value="Operations & HR" ${emp.department === 'Operations & HR' ? 'selected' : ''}>Operations & HR</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editEmpClass">Staff Classification</label>
                        <select class="form-control" id="editEmpClass" onchange="AeroApp.toggleClassificationFields(this, 'editEmp')">
                            <option value="w2" ${emp.classification === 'w2' ? 'selected' : ''}>W-2 Employee</option>
                            <option value="1099" ${emp.classification === '1099' ? 'selected' : ''}>1099 Contractor</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editEmpTypeSelect">Compensation Type</label>
                        <select class="form-control" id="editEmpTypeSelect" onchange="AeroApp.toggleRateLabels(this, 'editEmpRateLabel')">
                            <option value="salaried" ${emp.type === 'salaried' ? 'selected' : ''}>Salaried / Flat Rate</option>
                            <option value="hourly" ${emp.type === 'hourly' ? 'selected' : ''}>Hourly Basis</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="editEmpRate" id="editEmpRateLabel">${emp.type === 'hourly' ? 'Hourly Pay Rate ($)' : 'Annual Salary ($)'}</label>
                        <input type="number" step="any" class="form-control" id="editEmpRate" value="${emp.rate}" required>
                    </div>
                    <div class="form-group">
                        <label for="editEmpFreq">Pay Frequency</label>
                        <select class="form-control" id="editEmpFreq">
                            <option value="biweekly" ${emp.payFrequency === 'biweekly' ? 'selected' : ''}>Biweekly (26 periods)</option>
                            <option value="weekly" ${emp.payFrequency === 'weekly' ? 'selected' : ''}>Weekly (52 periods)</option>
                            <option value="semimonthly" ${emp.payFrequency === 'semimonthly' ? 'selected' : ''}>Semimonthly (24 periods)</option>
                            <option value="monthly" ${emp.payFrequency === 'monthly' ? 'selected' : ''}>Monthly (12 periods)</option>
                        </select>
                    </div>
                    <div class="form-group" id="editEmpFilingGroup" style="display: ${is1099 ? 'none' : 'block'};">
                        <label for="editEmpFiling">W-4 Filing Status</label>
                        <select class="form-control" id="editEmpFiling">
                            <option value="single" ${emp.filingStatus === 'single' ? 'selected' : ''}>Single</option>
                            <option value="married" ${emp.filingStatus === 'married' ? 'selected' : ''}>Married Filing Jointly</option>
                        </select>
                    </div>
                    <div class="form-group col-span-2">
                        <label for="editEmpReimbursement">Travel / Expense Reimbursement ($ per run)</label>
                        <input type="number" step="any" class="form-control" id="editEmpReimbursement" value="${benefits.reimbursement || 0}">
                    </div>
                </div>
                
                <div id="editEmpW2Fields" class="form-grid" style="margin-top:16px; padding-top:16px; border-top:1px dashed var(--border-color); display: ${is1099 ? 'none' : 'grid'};">
                    <h4 class="col-span-2" style="font-family:var(--font-heading); margin-bottom:8px;">W-2 Benefits Settings</h4>
                    <div class="form-group">
                        <label for="editEmp401k">Pre-tax 401(k) Rate (%)</label>
                        <input type="number" step="0.1" class="form-control" id="editEmp401k" value="${benefits.rate401k || 0}">
                    </div>
                    <div class="form-group">
                        <label for="editEmpMedical">Flat Health premium ($ per run)</label>
                        <input type="number" step="any" class="form-control" id="editEmpMedical" value="${benefits.medicalPremium || 0}">
                    </div>
                </div>
                
                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
                    <button type="button" class="btn btn-secondary" onclick="AeroApp.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Profile</button>
                </div>
            </form>
        `;
        this.openModal(`Edit ${emp.name}'s Profile`, body);
    },

    handleEditEmployee: async function(e, id) {
        e.preventDefault();
        const empIndex = this.state.employees.findIndex(emp => emp.id === id);
        if (empIndex === -1) return;
        const is1099 = document.getElementById('editEmpClass').value === '1099';
        const updated = {
            ...this.state.employees[empIndex],
            id,
            name:           document.getElementById('editEmpName').value,
            email:          document.getElementById('editEmpEmail').value,
            role:           document.getElementById('editEmpRole').value,
            state:          document.getElementById('editEmpState').value,
            department:     document.getElementById('editEmpDept').value,
            classification: document.getElementById('editEmpClass').value,
            type:           document.getElementById('editEmpTypeSelect').value,
            rate:           parseFloat(document.getElementById('editEmpRate').value),
            payFrequency:   document.getElementById('editEmpFreq').value,
            filingStatus:   is1099 ? 'single' : document.getElementById('editEmpFiling').value,
            benefits: {
                rate401k:       is1099 ? 0 : parseFloat(document.getElementById('editEmp401k').value)    || 0,
                medicalPremium: is1099 ? 0 : parseFloat(document.getElementById('editEmpMedical').value) || 0,
                reimbursement:  parseFloat(document.getElementById('editEmpReimbursement').value) || 0,
            },
        };
        try {
            await AeroDB.updateEmployee(id, updated);
            this.state.employees[empIndex] = updated;
            this.closeModal();
            this.showToast('Updated staff details.', 'success');
            this.navigateTo('employees');
        } catch (err) { this.showToast('Failed to update employee: ' + err.message, 'danger'); }
    },

    deleteEmployee: async function(id) {
        const emp = this.state.employees.find(e => e.id === id);
        if (!emp) return;
        if (confirm(`Are you sure you want to delete ${emp.name}?`)) {
            try {
                await AeroDB.deleteEmployee(id);
                this.state.employees = this.state.employees.filter(e => e.id !== id);
                this.showToast(`Offboarded ${emp.name}`, 'danger');
                this.navigateTo('employees');
                this.populateW2Selectors();
                if (typeof AeroBilling !== 'undefined') AeroBilling.updateSeatCount(this.state.employees.length);
            } catch (err) { this.showToast('Failed to offboard: ' + err.message, 'danger'); }
        }
    },


    // --- Time Tracking Handlers ---
    populateTimesheetEmployeeSelect: function() {
        const select = document.getElementById('timesheetEmployeeSelect');
        if (!select) return;
        
        const hourlyEmps = this.state.employees.filter(e => e.type === 'hourly');
        if (hourlyEmps.length === 0) {
            select.innerHTML = `<option value="">No hourly staff onboarded</option>`;
            return;
        }

        select.innerHTML = hourlyEmps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    },

    loadEmployeeTimesheet: function() {
        const empId = document.getElementById('timesheetEmployeeSelect').value;
        if (!empId) return;

        const emp = this.state.employees.find(e => e.id === empId);
        document.getElementById('timesheetPayRateBadge').textContent = `${formatCurrency(emp.rate)}/hr regular rate`;

        const hours = this.state.timesheets[empId] || [0, 0, 0, 0, 0, 0, 0];
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        let cellsHTML = "";
        days.forEach((day, idx) => {
            cellsHTML += `
                <div class="timesheet-day">
                    <span class="timesheet-day-name">${day}</span>
                    <input type="number" step="0.25" class="timesheet-day-input" data-day="${idx}" value="${hours[idx] || 0}" oninput="AeroApp.calculateTimesheetTotal()">
                </div>
            `;
        });

        document.getElementById('timesheetInputsContainer').innerHTML = cellsHTML;
        this.calculateTimesheetTotal();
    },

    calculateTimesheetTotal: function() {
        const empId = document.getElementById('timesheetEmployeeSelect').value;
        if (!empId) return;
        const emp = this.state.employees.find(e => e.id === empId);
        
        let total = 0;
        document.querySelectorAll('.timesheet-day-input').forEach(input => {
            total += parseFloat(input.value) || 0;
        });

        document.getElementById('timesheetTotalHrs').textContent = `${total.toFixed(2)} hrs`;

        // Overtime rule: hours exceeding 40 hours per week are calculated at 1.5x
        let reg = Math.min(40, total);
        let ot = Math.max(0, total - 40);

        document.getElementById('timesheetBreakdownHrs').textContent = `${reg.toFixed(2)}h Reg / ${ot.toFixed(2)}h OT`;

        // Estimate gross
        const estGross = (reg * emp.rate) + (ot * emp.rate * 1.5);
        document.getElementById('timesheetEstGross').textContent = formatCurrency(estGross);
    },

    resetTimesheet: function() {
        document.querySelectorAll('.timesheet-day-input').forEach(input => {
            input.value = 0;
        });
        this.calculateTimesheetTotal();
    },

    saveTimesheet: async function() {
        const empId = document.getElementById('timesheetEmployeeSelect').value;
        if (!empId) return;
        const hours = [];
        document.querySelectorAll('.timesheet-day-input').forEach(input => { hours.push(parseFloat(input.value) || 0); });
        try {
            await AeroDB.saveTimesheet(empId, hours);
            this.state.timesheets[empId] = hours;
            this.showToast('Timesheet saved and synced with payroll ledger.', 'success');
        } catch (err) { this.showToast('Failed to save timesheet: ' + err.message, 'danger'); }
    },


    // --- Payroll Run Wizard Orchestrator ---
    wizardGoToStep: function(step) {
        this.currentWizardStep = step;
        
        // Update Indicators
        for (let i = 1; i <= 3; i++) {
            const ind = document.getElementById(`stepIndicator${i}`);
            if (i < step) {
                ind.className = "wizard-step completed";
            } else if (i === step) {
                ind.className = "wizard-step active";
            } else {
                ind.className = "wizard-step";
            }
        }

        // Progress line percentage
        const progressLine = document.getElementById('wizardProgressBar');
        if (progressLine) {
            progressLine.style.width = `${(step - 1) * 50}%`;
        }

        // Toggle Views
        for (let i = 1; i <= 3; i++) {
            const view = document.getElementById(`wizardView${i}`);
            if (i === step) {
                view.classList.add('active');
            } else {
                view.classList.remove('active');
            }
        }

        // Setup individual steps
        if (step === 1) {
            this.buildWizardStep1();
        } else if (step === 2) {
            this.buildWizardStep2();
        } else if (step === 3) {
            this.buildWizardStep3();
        }
    },

    buildWizardStep1: function() {
        const body = document.getElementById('wizardHoursTableBody');
        if (!body) return;
        
        let html = "";
        this.state.employees.forEach(emp => {
            // Load timesheet hours if hourly
            let hours = 0;
            let ot = 0;
            if (emp.type === 'hourly') {
                const logged = this.state.timesheets[emp.id] || [0, 0, 0, 0, 0, 0, 0];
                const sum = logged.reduce((a,b)=>a+b, 0);
                hours = Math.min(40, sum);
                ot = Math.max(0, sum - 40);
            }
            
            const is1099 = emp.classification === '1099';
            const benefits = emp.benefits || { rate401k: 0, medicalPremium: 0, reimbursement: 0 };
            
            // Generate rows
            html += `
                <tr id="wizard-row-${emp.id}">
                    <td>
                        <div style="display:flex; align-items:center;">
                            <div style="font-weight:600;">${emp.name}</div>
                            ${is1099 ? '<span class="badge badge-warning" style="margin-left: 6px; font-size:10px; padding:1px 4px;">1099</span>' : '<span class="badge badge-success" style="margin-left: 6px; font-size:10px; padding:1px 4px;">W-2</span>'}
                        </div>
                        <div style="font-size:11px; color:var(--text-tertiary);">${emp.role}</div>
                    </td>
                    <td>
                        <div style="font-size:13px; font-weight:600;">${emp.type === 'salaried' ? formatCurrency(emp.rate) + (is1099 ? '/run' : '/yr') : formatCurrency(emp.rate) + '/hr'}</div>
                        <div style="font-size:11px; text-transform:capitalize;">${emp.payFrequency}</div>
                    </td>
                    <td>
                        ${emp.type === 'salaried' 
                            ? `<span style="color:var(--text-tertiary); font-size:13px;">Auto-calculated</span>` 
                            : `<input type="number" step="0.1" class="form-control wiz-input-hours" style="width:70px; text-align:center;" value="${hours}" data-empid="${emp.id}" oninput="AeroApp.updateWizardRowGross('${emp.id}')">`}
                    </td>
                    <td>
                        ${emp.type === 'salaried' 
                            ? `<span style="color:var(--text-tertiary); font-size:13px;">--</span>` 
                            : `<input type="number" step="0.1" class="form-control wiz-input-ot" style="width:70px; text-align:center;" value="${ot}" data-empid="${emp.id}" oninput="AeroApp.updateWizardRowGross('${emp.id}')">`}
                    </td>
                    <td>
                        <input type="number" step="any" class="form-control wiz-input-bonus" style="width:75px; text-align:center;" value="0" data-empid="${emp.id}" oninput="AeroApp.updateWizardRowGross('${emp.id}')">
                    </td>
                    <td>
                        <input type="number" step="any" class="form-control wiz-input-commission" style="width:75px; text-align:center;" value="0" data-empid="${emp.id}" oninput="AeroApp.updateWizardRowGross('${emp.id}')">
                    </td>
                    <td>
                        ${is1099 
                            ? `<span style="color:var(--text-tertiary); font-size:12px;">N/A</span><input type="hidden" class="wiz-input-401k" value="0">`
                            : `<input type="number" step="0.1" class="form-control wiz-input-401k" style="width:65px; text-align:center;" value="${benefits.rate401k || 0}" data-empid="${emp.id}">`}
                    </td>
                    <td>
                        ${is1099 
                            ? `<span style="color:var(--text-tertiary); font-size:12px;">N/A</span><input type="hidden" class="wiz-input-medical" value="0">`
                            : `<input type="number" step="any" class="form-control wiz-input-medical" style="width:75px; text-align:center;" value="${benefits.medicalPremium || 0}" data-empid="${emp.id}">`}
                    </td>
                    <td>
                        <input type="number" step="any" class="form-control wiz-input-reimbursement" style="width:75px; text-align:center;" value="${benefits.reimbursement || 0}" data-empid="${emp.id}">
                    </td>
                    <td style="text-align: right; font-weight: 700; color:var(--text-primary);" id="wiz-gross-val-${emp.id}">
                        $0.00
                    </td>
                </tr>
            `;
        });
        
        body.innerHTML = html;
        
        // Trigger initial row evaluations
        this.state.employees.forEach(emp => {
            this.updateWizardRowGross(emp.id);
        });
    },

    updateWizardRowGross: function(empId) {
        const emp = this.state.employees.find(e => e.id === empId);
        if (!emp) return;
        
        let gross = 0;
        const row = document.getElementById(`wizard-row-${empId}`);
        if (!row) return;

        if (emp.type === 'salaried') {
            if (emp.classification === '1099') {
                gross = emp.rate; // Flat period rate for salaried contractors
            } else {
                const freqFactor = PAY_FREQUENCIES[emp.payFrequency] || 26;
                gross = emp.rate / freqFactor;
            }
        } else {
            const hours = parseFloat(row.querySelector('.wiz-input-hours').value) || 0;
            const ot = parseFloat(row.querySelector('.wiz-input-ot').value) || 0;
            if (emp.classification === '1099') {
                gross = (hours + ot) * emp.rate; // Straight time for 1099 contractors
            } else {
                gross = (hours * emp.rate) + (ot * emp.rate * 1.5);
            }
        }

        const bonus = parseFloat(row.querySelector('.wiz-input-bonus').value) || 0;
        const comms = parseFloat(row.querySelector('.wiz-input-commission').value) || 0;
        gross += bonus + comms;

        document.getElementById(`wiz-gross-val-${empId}`).textContent = formatCurrency(gross);
    },

    buildWizardStep2: function() {
        const body = document.getElementById('wizardTaxTableBody');
        if (!body) return;

        this.activeRunData = {}; // Clear previous evaluations

        let html = "";
        this.state.employees.forEach(emp => {
            // Find input values from DOM Step 1
            let hours = 0;
            let ot = 0;
            let bonus = 0;
            let comms = 0;
            let rate401k = 0;
            let medicalDed = 0;
            let reimbursement = 0;

            const step1Row = document.getElementById(`wizard-row-${emp.id}`);
            if (step1Row) {
                if (emp.type === 'hourly') {
                    hours = parseFloat(step1Row.querySelector('.wiz-input-hours').value) || 0;
                    ot = parseFloat(step1Row.querySelector('.wiz-input-ot').value) || 0;
                }
                bonus = parseFloat(step1Row.querySelector('.wiz-input-bonus').value) || 0;
                comms = parseFloat(step1Row.querySelector('.wiz-input-commission').value) || 0;
                
                rate401k = parseFloat(step1Row.querySelector('.wiz-input-401k').value) || 0;
                medicalDed = parseFloat(step1Row.querySelector('.wiz-input-medical').value) || 0;
                reimbursement = parseFloat(step1Row.querySelector('.wiz-input-reimbursement').value) || 0;
            }

            // Calculate base salary gross
            let baseSalaryGross = 0;
            if (emp.type === 'salaried') {
                if (emp.classification === '1099') {
                    baseSalaryGross = emp.rate;
                } else {
                    const freqFactor = PAY_FREQUENCIES[emp.payFrequency] || 26;
                    baseSalaryGross = emp.rate / freqFactor;
                }
            } else {
                if (emp.classification === '1099') {
                    baseSalaryGross = (hours + ot) * emp.rate;
                } else {
                    baseSalaryGross = (hours * emp.rate) + (ot * emp.rate * 1.5);
                }
            }
            const totalGross = baseSalaryGross + bonus + comms;
            const deduction401k = totalGross * (rate401k / 100);

            // Find approved pay advance for this employee in the current run:
            const approvedAdvance = this.state.payAdvances.find(adv => adv.empId === emp.id && adv.status === 'approved');
            const payAdvanceDeductionVal = approvedAdvance ? approvedAdvance.amount : 0;

            // Setup parameters
            const currentRunParams = {
                hours: hours,
                overtimeHours: ot,
                bonus: bonus,
                commissions: comms,
                deduction401k: deduction401k,
                deductionMedical: medicalDed,
                deductionPostTax: 0,
                payAdvanceDeduction: payAdvanceDeductionVal,
                reimbursement: reimbursement
            };

            // Retrieve YTD Gross from history logs to factor limits
            let ytdGross = 0;
            this.state.payrollHistory.forEach(h => {
                if (h.details && h.details[emp.id]) {
                    ytdGross += h.details[emp.id].grossPay;
                }
            });

            // Calculate EXACT payroll via the engine!
            const calculations = calculatePayroll(emp, currentRunParams, ytdGross);
            
            // Store results
            this.activeRunData[emp.id] = {
                employee: emp,
                params: currentRunParams,
                results: calculations
            };

            const is1099 = emp.classification === '1099';

            html += `
                <tr style="cursor:pointer;" onclick="AeroApp.previewEmployeePaystub('${emp.id}')" title="Click to view detailed pay stub">
                    <td>
                        <div style="display:flex; align-items:center;">
                            <div style="font-weight:600; text-decoration: underline; color: var(--primary);">${emp.name}</div>
                            ${is1099 ? '<span class="badge badge-warning" style="margin-left: 6px; font-size:10px; padding:1px 4px;">1099</span>' : '<span class="badge badge-success" style="margin-left: 6px; font-size:10px; padding:1px 4px;">W-2</span>'}
                        </div>
                        <div style="font-size:11px; color:var(--text-tertiary);">${emp.role}</div>
                    </td>
                    <td style="font-weight:600;">${formatCurrency(calculations.grossPay)}</td>
                    <td>${is1099 ? '--' : formatCurrency(calculations.taxes.federalIncomeTax)}</td>
                    <td>${is1099 ? '--' : formatCurrency(calculations.taxes.socialSecurity + calculations.taxes.medicare)}</td>
                    <td>${is1099 ? '--' : formatCurrency(calculations.taxes.stateIncomeTax)}</td>
                    <td>${is1099 ? '--' : formatCurrency(calculations.preTaxDeductions)}</td>
                    <td style="font-weight:700; color:var(--success);">${formatCurrency(calculations.netPay)}</td>
                    <td style="text-align: right; font-weight:700;">${formatCurrency(calculations.totalPayrollCost)}</td>
                </tr>
            `;
        });

        body.innerHTML = html;
    },

    buildWizardStep3: function() {
        let netSum = 0;
        let taxSum = 0;
        let totalDebitSum = 0;

        Object.values(this.activeRunData).forEach(entry => {
            netSum += entry.results.netPay;
            // Employee taxes + Employer taxes = Tax liabilities to pay
            taxSum += entry.results.taxes.totalEmployeeTaxes + entry.results.employerTaxes.totalEmployerTaxes;
            totalDebitSum += entry.results.totalPayrollCost;
        });

        document.getElementById('wizardNetWagesSum').textContent = formatCurrency(netSum);
        document.getElementById('wizardTaxLiabilitiesSum').textContent = formatCurrency(taxSum);
        document.getElementById('wizardTotalDebitSum').textContent = formatCurrency(totalDebitSum);
    },

    previewEmployeePaystub: function(empId) {
        const entry = this.activeRunData[empId];
        if (!entry) return;
        
        const dateRange = "June 01 - June 14, 2026";
        const is1099 = entry.employee.classification === '1099';
        const stubHTML = is1099
            ? getContractorReceiptHTML(entry.employee, entry.results, dateRange)
            : getPaystubHTML(entry.employee, entry.results, dateRange);
        
        const fullContent = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:12px;" class="no-print">
                <button class="btn btn-outline" onclick="window.print()">
                    <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7h-1V4a1 1 0 00-1-1H7a1 1 0 00-1 1v3H5a2 2 0 00-2 2v6a2 2 0 002 2h2v3a1 1 0 001 1h8a1 1 0 001-1v-3h2a2 2 0 002-2V9a2 2 0 00-2-2zM7 5h10v2H7V5zm10 14H7v-4h10v4z"></path></svg>
                    Print Statement
                </button>
            </div>
            ${stubHTML}
        `;
        
        this.openModal(`${is1099 ? 'Contractor Receipt' : 'Pay Stub Statement'}: ${entry.employee.name}`, fullContent, true);
    },

    submitPayrollRun: async function() {
        let grossPayrollSum = 0, employerTaxesSum = 0, totalCostSum = 0;
        Object.values(this.activeRunData).forEach(data => {
            grossPayrollSum  += data.results.grossPay;
            employerTaxesSum += data.results.totalEmployerTaxes;
            totalCostSum     += data.results.totalPayrollCost;
        });
        const today        = new Date();
        const periodEnd    = today.toISOString().slice(0, 10);
        const periodStartD = new Date(today); periodStartD.setDate(today.getDate() - 13);
        const periodStart  = periodStartD.toISOString().slice(0, 10);
        const runSummary   = {
            grossPayroll:  grossPayrollSum,
            employerTaxes: employerTaxesSum,
            totalCost:     totalCostSum,
            employeeCount: Object.keys(this.activeRunData).length,
            periodStart,
            periodEnd,
        };
        try {
            const newRunId = await AeroDB.savePayrollRun(runSummary, this.activeRunData);
            for (const [empId, data] of Object.entries(this.activeRunData)) {
                const emp = this.state.employees.find(e => e.id === empId);
                if (emp?.garnishments?.length && data.results.garnishmentDeductions > 0) {
                    let rem = data.results.garnishmentDeductions;
                    for (const g of emp.garnishments) {
                        const d = Math.min(parseFloat(g.amount)||0, rem);
                        if (d > 0) { await AeroDB.updateGarnishmentYTD(g.id, d); rem -= d; }
                    }
                }
                if (data.results.payAdvanceDeduction > 0) {
                    const adv = this.state.payAdvances.find(a => a.empId === empId && a.status === 'approved');
                    if (adv) await AeroDB.repayPayAdvance(adv.id, newRunId);
                }
            }
            const integ = this.state.integrations || {};
            if (integ.quickbooks) await AeroDB.addSyncLog('quickbooks', `Synced period ${periodEnd} — Gross: ${formatCurrency(grossPayrollSum)}`, totalCostSum, newRunId);
            if (integ.xero)       await AeroDB.addSyncLog('xero', `Exported salaries ledger for period ${periodEnd}`, totalCostSum, newRunId);
            await this._refreshState();
            this.showToast('Payroll successfully submitted! ACH transfers scheduled.', 'success');
            this.navigateTo('dashboard');
        } catch (err) { this.showToast('Payroll submission failed: ' + err.message, 'danger'); }
    },

    showPayrollHistoryDetails: function(runId) {
        const run = this.state.payrollHistory.find(r => r.id === runId);
        if (!run) return;
        
        let detailsRows = "";
        // If there are detailed calculations saved
        if (run.details && Object.keys(run.details).length > 0) {
            Object.entries(run.details).forEach(([empId, det]) => {
                const emp = this.state.employees.find(e => e.id === empId) || { name: "Employee" };
                detailsRows += `
                    <tr>
                        <td style="font-weight:600;">${emp.name}</td>
                        <td>${formatCurrency(det.grossPay)}</td>
                        <td>${formatCurrency(det.taxes.totalEmployeeTaxes)}</td>
                        <td style="color:var(--success); font-weight:700;">${formatCurrency(det.netPay)}</td>
                        <td style="text-align:right; font-weight:600;">${formatCurrency(det.totalPayrollCost)}</td>
                    </tr>
                `;
            });
        } else {
            // Seed runs fallback
            detailsRows = `<tr><td colspan="5" style="text-align:center; color:var(--text-tertiary);">Itemized run details archived.</td></tr>`;
        }

        const body = `
            <div style="font-size:14px; margin-bottom:16px;">
                <p><strong>Payroll Run Date:</strong> ${run.date}</p>
                <p><strong>Total Gross Wages Paid:</strong> ${formatCurrency(run.grossPayroll)}</p>
                <p><strong>Employer Contribution:</strong> ${formatCurrency(run.employerTaxes)}</p>
                <p><strong>Total Cash Debited:</strong> <span style="font-weight:700; color:var(--primary);">${formatCurrency(run.totalCost)}</span></p>
            </div>
            <h4 style="margin-bottom:8px; font-family:var(--font-heading)">Deposited Pay Checks</h4>
            <div class="table-wrapper" style="border: 1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
                <table class="table-responsive">
                    <thead style="background-color: var(--bg-tertiary)">
                        <tr>
                            <th>Employee</th>
                            <th>Gross Pay</th>
                            <th>Taxes Deducted</th>
                            <th>Net Pay</th>
                            <th style="text-align:right;">Employer Cost</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${detailsRows}
                    </tbody>
                </table>
            </div>
        `;
        
        this.openModal(`Payroll Audit Statement (${runId})`, body, true);
    },


    // --- Tax Compliance Hub Handlers ---
    updateComplianceNumbers: function() {
        // Numbers are now computed inside renderTaxComplianceView dynamically.
        // Just repopulate the W-2 / 1099 selectors.
        this.populateW2Selectors();
    },

    switchComplianceTab: function(tab) {
        ['federal','state','forms','history'].forEach(t => {
            const btn   = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
            const panel = document.getElementById('complianceTab' + t.charAt(0).toUpperCase() + t.slice(1));
            if (btn)   btn.classList.toggle('active', t === tab);
            if (panel) panel.style.display = t === tab ? 'block' : 'none';
        });
        // Re-populate selectors when landing on the forms tab
        if (tab === 'forms') this.populateW2Selectors();
    },

    markFiled: async function(formRef, formType, period, agency, amount) {
        try {
            const company = await AeroDB.getCompany();
            const user    = await AeroDB.getUser();

            await _sb.from('filing_records').insert({
                company_id:  company.id,
                form_type:   formType,
                period,
                agency,
                amount_due:  amount,
                amount_paid: amount,
                due_date:    new Date().toISOString().slice(0, 10),
                filed_at:    new Date().toISOString(),
                status:      'filed',
                filed_by:    user?.id || null,
            });

            // Add to local state so the UI updates instantly
            if (!this.state.filingRecords) this.state.filingRecords = [];
            this.state.filingRecords.unshift({
                form_type:   formType,
                form_ref:    formRef,
                period,
                agency,
                amount_paid: amount,
                filed_at:    new Date().toISOString(),
                actor_label: user?.email || 'Admin',
            });

            await AeroDB.addAuditLog(
                `Tax Filing Confirmed`,
                `${formType} for ${period} filed with ${agency}${amount > 0 ? ' — ' + formatCurrency(amount) : ''}`,
                'payroll'
            );

            this.showToast(`${formType} (${period}) marked as filed ✓`, 'success');
            this.navigateTo('tax-compliance');
        } catch (err) {
            this.showToast('Failed to record filing: ' + err.message, 'danger');
        }
    },

    populateW2Selectors: function() {
        const select = document.getElementById('w2EmployeeSelect');
        if (select) {
            select.innerHTML = this.state.employees
                .filter(e => e.classification !== '1099')
                .map(e => `<option value="${e.id}">${e.name}</option>`)
                .join('');
        }
        
        const selectNec = document.getElementById('necContractorSelect');
        if (selectNec) {
            selectNec.innerHTML = this.state.employees
                .filter(e => e.classification === '1099')
                .map(e => `<option value="${e.id}">${e.name}</option>`)
                .join('');
        }
    },

    simulateForm941: function() {
        const formHTML = getForm941HTML(this.state);
        this.openModal("IRS Form 941 Quarterly E-File Preview", formHTML, true);
    },

    generateW2: function() {
        const empId = document.getElementById('w2EmployeeSelect').value;
        if (!empId) return;
        const emp = this.state.employees.find(e => e.id === empId);
        
        const sigRecord = this.state.w2Signatures ? this.state.w2Signatures[empId] : null;
        const isSigned = !!sigRecord;
        const w2HTML = getW2HTML(emp, this.state, sigRecord);
        const fullContent = `
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-bottom:14px;" class="no-print">
                ${isSigned ? `<span class="badge badge-success" style="padding:8px 14px; display:flex; align-items:center; gap:6px;">
                    <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Signed ${sigRecord.timestamp}
                </span>` : `<span class="badge badge-warning" style="padding:8px 14px; display:flex; align-items:center; gap:6px;">
                    <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Awaiting Employee Signature
                </span>`}
                <button class="btn btn-outline" onclick="window.print()">
                    <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7h-1V4a1 1 0 00-1-1H7a1 1 0 00-1 1v3H5a2 2 0 00-2 2v6a2 2 0 002 2h2v3a1 1 0 001 1h8a1 1 0 001-1v-3h2a2 2 0 002-2V9a2 2 0 00-2-2zM7 5h10v2H7V5zm10 14H7v-4h10v4z"></path></svg>
                    Print W-2
                </button>
            </div>
            ${w2HTML}
        `;
        this.openModal(`IRS Form W-2: ${emp.name}`, fullContent, true);
    },

    generate1099: function() {
        const empId = document.getElementById('necContractorSelect').value;
        if (!empId) return;
        const emp = this.state.employees.find(e => e.id === empId);
        
        const necHTML = get1099NECHTML(emp, this.state);
        this.openModal(`IRS Form 1099-NEC: ${emp.name}`, necHTML, true);
    },


    // --- Accounting Integrations Handlers ---
    toggleIntegration: async function(name) {
        try {
            await AeroDB.toggleIntegration(name);
            this.state.integrations[name] = !this.state.integrations[name];
            const isConnected = this.state.integrations[name];
            this.showToast(`${name === 'quickbooks' ? 'QuickBooks Online' : 'Xero'} ${isConnected ? 'connected' : 'disconnected'}.`, isConnected ? 'success' : 'danger');
            this.navigateTo('integrations');
        } catch (err) { this.showToast('Failed to toggle integration: ' + err.message, 'danger'); }
    },

    renderSyncLogs: function() {
        const body = document.getElementById('integrationSyncLogsBody');
        if (!body) return;

        if (this.state.syncLogs.length === 0) {
            body.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-tertiary);">No ledger synchronization entries recorded yet.</td></tr>`;
            return;
        }

        body.innerHTML = this.state.syncLogs.map(log => `
            <tr>
                <td style="font-weight:600;">${log.date}</td>
                <td><span class="badge badge-info">${log.type}</span></td>
                <td><div style="font-size:12px; max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${log.details}</div></td>
                <td>${formatCurrency(log.debit)}</td>
                <td>${formatCurrency(log.credit)}</td>
                <td><span class="badge badge-success">${log.status}</span></td>
            </tr>
        `).join('');
    },


    // --- Settings View Handlers ---
    saveSettings: async function(e) {
        e.preventDefault();
        const fields = {
            companyName:   document.getElementById('companyName').value,
            ein:           document.getElementById('companyEin').value,
            bankName:      document.getElementById('bankName').value,
            routingNumber: document.getElementById('bankRouting').value,
            accountNumber: document.getElementById('bankAccount').value,
            paymentType:   document.getElementById('paymentType').value,
        };
        try {
            await AeroDB.saveCompany(fields);
            this.state.settings = { ...this.state.settings, ...fields };
            await AeroDB.addAuditLog('Settings Updated', 'Company settings saved', 'settings');
            this.showToast('Company accounting settings updated successfully.', 'success');
        } catch (err) { this.showToast('Failed to save settings: ' + err.message, 'danger'); }
    },

    // --- Unified Portal Authentication Handlers ---
    switchLoginTab: function(role) {
        const tabCompany = document.getElementById('btnTabCompany');
        const tabEmployee = document.getElementById('btnTabEmployee');
        const formCompany = document.getElementById('formCompanyLogin');
        const formEmployee = document.getElementById('formEmployeeLogin');

        if (role === 'company') {
            tabCompany.classList.add('active');
            tabEmployee.classList.remove('active');
            formCompany.classList.add('active');
            formEmployee.classList.remove('active');
        } else {
            tabCompany.classList.remove('active');
            tabEmployee.classList.add('active');
            formCompany.classList.remove('active');
            formEmployee.classList.add('active');
        }
    },

    handleLogin: async function(e, role) {
        e.preventDefault();
        const emailId = role === 'company' ? 'companyEmailInput' : 'employeeEmailInput';
        const passId  = role === 'company' ? 'companyPasswordInput' : 'employeePINInput';
        const btnId   = role === 'company' ? 'btnCompanySignIn' : 'btnEmployeeSignIn';
        const email   = document.getElementById(emailId)?.value?.trim();
        const pass    = document.getElementById(passId)?.value;
        const btn     = document.getElementById(btnId);
        if (!email || !pass) { this.showToast('Please enter your email and password.', 'warning'); return; }
        this._setButtonLoading(btn, true);
        try {
            await AeroDB.signIn(email, pass);
        } catch (err) {
            this.showToast(err.message || 'Invalid credentials.', 'danger');
            this._setButtonLoading(btn, false);
        }
    },

    logout: async function() {
        await AeroDB.signOut();
        this.showToast('Logged out successfully.', 'info');
    },

    switchLoginTab: function(tab) {
        const tabs  = { company: 'btnTabCompany', employee: 'btnTabEmployee', register: 'btnTabRegister' };
        const forms = { company: 'formCompanyLogin', employee: 'formEmployeeLogin', register: 'formRegister' };
        const titles = {
            company:  ['Secure Login Portal',   'Authenticate to view payroll data'],
            employee: ['Employee Portal',        'Sign in with your work email'],
            register: ['Create Free Account',    'Set up AeroPay for your company'],
        };
        Object.keys(tabs).forEach(key => {
            document.getElementById(tabs[key])?.classList.toggle('active', key === tab);
            document.getElementById(forms[key])?.classList.toggle('active', key === tab);
        });
        const t = titles[tab];
        const titleEl = document.getElementById('loginCardTitle');
        const subEl   = document.getElementById('loginCardSubtitle');
        if (titleEl && t) titleEl.textContent = t[0];
        if (subEl   && t) subEl.textContent   = t[1];
        if (tab === 'register') {
            document.getElementById('regStep1')?.style.setProperty('display','block');
            document.getElementById('regStep2')?.style.setProperty('display','none');
            document.getElementById('regSuccess')?.style.setProperty('display','none');
        }
    },

    regNextStep: function() {
        const name    = document.getElementById('regName').value.trim();
        const email   = document.getElementById('regEmail').value.trim();
        const pass    = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regPasswordConfirm').value;
        if (!name)           return this.showToast('Please enter your full name.', 'warning');
        if (!email)          return this.showToast('Please enter your email.', 'warning');
        if (pass.length < 8) return this.showToast('Password must be at least 8 characters.', 'warning');
        if (pass !== confirm) return this.showToast('Passwords do not match.', 'warning');
        document.getElementById('regStep1').style.display = 'none';
        document.getElementById('regStep2').style.display = 'block';
        document.getElementById('regHaveAccount').style.display = 'none';
        document.getElementById('regCompanyName').focus();
    },

    regPrevStep: function() {
        document.getElementById('regStep2').style.display = 'none';
        document.getElementById('regStep1').style.display = 'block';
        document.getElementById('regHaveAccount').style.display = '';
    },

    handleSignUp: async function(e) {
        e.preventDefault();
        const email       = document.getElementById('regEmail').value.trim();
        const password    = document.getElementById('regPassword').value;
        const companyName = document.getElementById('regCompanyName').value.trim();
        if (!companyName) return this.showToast('Please enter your company name.', 'warning');
        const btn = document.getElementById('btnRegSubmit');
        this._setButtonLoading(btn, true);
        try {
            await AeroDB.signUp(email, password, companyName);
            document.getElementById('regStep2').style.display   = 'none';
            document.getElementById('regSuccess').style.display = 'block';
            document.getElementById('regHaveAccount').style.display = 'none';
            const lbl = document.getElementById('regSuccessEmail');
            if (lbl) lbl.textContent = `Confirmation sent to: ${email}`;
        } catch (err) {
            this.showToast(err.message || 'Registration failed. Please try again.', 'danger');
        } finally {
            this._setButtonLoading(btn, false);
        }
    },

    handleForgotPassword: async function() {
        const email = (document.getElementById('companyEmailInput') || document.getElementById('employeeEmailInput'))?.value?.trim();
        if (!email) { this.showToast('Enter your email above first.', 'warning'); return; }
        try {
            const { error } = await _sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
            if (error) throw error;
            this.showToast(`Password reset email sent to ${email}`, 'success');
        } catch (err) { this.showToast(err.message || 'Could not send reset email.', 'danger'); }
    },

    togglePasswordVisibility: function(inputId, btn) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.querySelector('svg').style.opacity = input.type === 'text' ? '0.5' : '1';
    },

    updatePasswordStrength: function(val) {
        const fill = document.getElementById('passwordStrengthFill');
        const lbl  = document.getElementById('passwordStrengthLabel');
        if (!fill || !lbl) return;
        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        const levels = [
            { w:'25%', cls:'strength-weak',   text:'Weak'   },
            { w:'50%', cls:'strength-fair',   text:'Fair'   },
            { w:'75%', cls:'strength-good',   text:'Good'   },
            { w:'100%',cls:'strength-strong', text:'Strong' },
        ];
        const lvl = levels[Math.max(0, score - 1)] || levels[0];
        fill.style.width = val.length === 0 ? '0%' : lvl.w;
        fill.className   = val.length === 0 ? '' : lvl.cls;
        lbl.textContent  = val.length === 0 ? '' : lvl.text;
    },

    _setButtonLoading: function(btn, loading) {
        if (!btn) return;
        btn.disabled = loading;
        const text    = btn.querySelector('.login-btn-text');
        const spinner = btn.querySelector('.login-spinner');
        if (text)    text.style.display    = loading ? 'none' : '';
        if (spinner) spinner.style.display = loading ? 'flex'  : 'none';
    },

    toggleTheme: function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        this.showToast(`Theme switched to ${newTheme} mode`, 'success');
    },

    filterComparisonTable: function(category) {
        const btnAll = document.getElementById('btnFilterAll');
        const btnSpeedPrice = document.getElementById('btnFilterSpeedPrice');
        const btnComplianceAPI = document.getElementById('btnFilterComplianceAPI');

        if (btnAll) btnAll.classList.remove('active');
        if (btnSpeedPrice) btnSpeedPrice.classList.remove('active');
        if (btnComplianceAPI) btnComplianceAPI.classList.remove('active');

        if (category === 'all') {
            if (btnAll) btnAll.classList.add('active');
        } else if (category === 'speed-price') {
            if (btnSpeedPrice) btnSpeedPrice.classList.add('active');
        } else if (category === 'compliance-api') {
            if (btnComplianceAPI) btnComplianceAPI.classList.add('active');
        }

        document.querySelectorAll('.comp-table tbody tr').forEach(row => {
            const rowCat = row.getAttribute('data-category');
            if (category === 'all' || rowCat === category) {
                row.classList.remove('filtered-out');
            } else {
                row.classList.add('filtered-out');
            }
        });
    },

    filterStaffList: function(category) {
        const btnAll = document.getElementById('btnStaffAll');
        const btnW2 = document.getElementById('btnStaffW2');
        const btn1099 = document.getElementById('btnStaff1099');

        if (btnAll) btnAll.classList.remove('active');
        if (btnW2) btnW2.classList.remove('active');
        if (btn1099) btn1099.classList.remove('active');

        if (category === 'all') {
            if (btnAll) btnAll.classList.add('active');
        } else if (category === 'w2') {
            if (btnW2) btnW2.classList.add('active');
        } else if (category === '1099') {
            if (btn1099) btn1099.classList.add('active');
        }

        document.querySelectorAll('.staff-table tbody tr').forEach(row => {
            const rowClass = row.getAttribute('data-classification');
            if (category === 'all' || rowClass === category) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    },

    updateSidebarProfile: function() {
        const avatar = document.getElementById('profileAvatar');
        const name = document.getElementById('profileUserName');
        const role = document.getElementById('profileUserRole');

        if (this.session && this.session.isLoggedIn) {
            if (avatar) avatar.textContent = this.session.userName.split(' ').map(n=>n[0]).join('');
            if (name) name.textContent = this.session.userName;
            if (role) role.textContent = this.session.userRole;
        } else {
            if (avatar) avatar.textContent = "MT";
            if (name) name.textContent = "Michael Tan";
            if (role) role.textContent = "Administrator";
        }
    },

    previewEmployeePaystubFromId: function(employeeId, runId) {
        const run = this.state.payrollHistory.find(r => r.id === runId);
        if (!run || !run.details[employeeId]) {
            this.showToast("Paystub statement details not found.", "danger");
            return;
        }
        
        const employee = this.state.employees.find(e => e.id === employeeId);
        const results = run.details[employeeId];
        const dateRange = "Pay Period Ending " + run.date;
        const is1099 = employee.classification === '1099';
        const stubHTML = is1099
            ? getContractorReceiptHTML(employee, results, dateRange)
            : getPaystubHTML(employee, results, dateRange);
        
        const fullContent = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:12px;" class="no-print">
                <button class="btn btn-outline" onclick="window.print()">
                    <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7h-1V4a1 1 0 00-1-1H7a1 1 0 00-1 1v3H5a2 2 0 00-2 2v6a2 2 0 002 2h2v3a1 1 0 001 1h8a1 1 0 001-1v-3h2a2 2 0 002-2V9a2 2 0 00-2-2zM7 5h10v2H7V5zm10 14H7v-4h10v4z"></path></svg>
                    Print Statement
                </button>
            </div>
            ${stubHTML}
        `;
        
        this.openModal(`${is1099 ? 'Contractor Receipt' : 'Pay Stub Statement'}: ${employee.name}`, fullContent, true);
    },

    generateEmployeeW2: function() {
        const employee = this.state.employees.find(e => e.id === this.session.employeeId);
        if (!employee) return;
        const sigRecord = this.state.w2Signatures[employee.id];
        const w2HTML = getW2HTML(employee, this.state, sigRecord);
        const isSigned = !!sigRecord;
        const fullContent = `
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-bottom:14px;" class="no-print">
                ${!isSigned ? `<button class="btn btn-primary" onclick="AeroApp.openW2SignaturePad('${employee.id}')">
                    <svg style="width:16px;height:16px;margin-right:6px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    Sign W-2 Digitally
                </button>` : `<span class="badge badge-success" style="padding:8px 14px; display:flex; align-items:center; gap:6px;">
                    <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Signed ${sigRecord.timestamp}
                </span>`}
                <button class="btn btn-outline" onclick="window.print()">
                    <svg style="width:16px;height:16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7h-1V4a1 1 0 00-1-1H7a1 1 0 00-1 1v3H5a2 2 0 00-2 2v6a2 2 0 002 2h2v3a1 1 0 001 1h8a1 1 0 001-1v-3h2a2 2 0 002-2V9a2 2 0 00-2-2zM7 5h10v2H7V5zm10 14H7v-4h10v4z"></path></svg>
                    Print W-2
                </button>
            </div>
            ${w2HTML}
        `;
        this.openModal(`IRS Form W-2: ${employee.name}`, fullContent, true);
    },

    openW2SignaturePad: function(employeeId) {
        const employee = this.state.employees.find(e => e.id === employeeId);
        if (!employee) return;
        const padHTML = getW2SignaturePadHTML(employee);
        this.openModal(`Sign Form W-2: ${employee.name}`, padHTML, true);
        // Initialize canvas after modal DOM is ready
        setTimeout(() => this._initSignatureCanvas(employeeId), 50);
    },

    _initSignatureCanvas: function(employeeId) {
        const canvas = document.getElementById('w2SignatureCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Set canvas internal resolution to match display size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        let hasDrawn = false;

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const source = e.touches ? e.touches[0] : e;
            return { x: source.clientX - r.left, y: source.clientY - r.top };
        };

        const startDraw = (e) => {
            e.preventDefault();
            isDrawing = true;
            const pos = getPos(e);
            lastX = pos.x; lastY = pos.y;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
        };

        const draw = (e) => {
            if (!isDrawing) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            lastX = pos.x; lastY = pos.y;
            hasDrawn = true;
            // Only enable submit if checkbox is also checked
            const checkbox = document.getElementById('w2AgreeCheck');
            const btn = document.getElementById('w2SignSubmitBtn');
            if (btn && checkbox && checkbox.checked) btn.disabled = false;
        };

        const stopDraw = () => { isDrawing = false; };

        canvas.addEventListener('mousedown', startDraw);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDraw);
        canvas.addEventListener('mouseleave', stopDraw);
        canvas.addEventListener('touchstart', startDraw, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDraw);

        // Store ref for clear/submit
        window._w2SignCanvas = canvas;
        window._w2SignCtx = ctx;
        window._w2SignEmployeeId = employeeId;
    },

    clearSignaturePad: function() {
        const canvas = window._w2SignCanvas;
        if (!canvas) return;
        const ctx = window._w2SignCtx;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const btn = document.getElementById('w2SignSubmitBtn');
        if (btn) btn.disabled = true;
    },

    submitW2Signature: async function() {
        const canvas     = window._w2SignCanvas;
        const employeeId = window._w2SignEmployeeId;
        if (!canvas || !employeeId) return;
        const ctx       = canvas.getContext('2d');
        const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        if (!pixelData.some(v => v !== 0)) { this.showToast('Please draw your signature before submitting.', 'danger'); return; }
        const sigData  = canvas.toDataURL('image/png');
        const employee = this.state.employees.find(e => e.id === employeeId);
        try {
            await AeroDB.saveW2Signature(employeeId, sigData, 'client', navigator.userAgent.slice(0, 120));
            if (!this.state.w2Signatures) this.state.w2Signatures = {};
            this.state.w2Signatures[employeeId] = {
                employeeId, signatureData: sigData,
                timestamp: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            };
            this.closeModal();
            this.showToast(`W-2 signed successfully by ${employee?.name}!`, 'success');
            setTimeout(() => this.generateEmployeeW2(), 300);
        } catch (err) { this.showToast('Failed to save signature: ' + err.message, 'danger'); }
    },

    generateEmployee1099: function() {
        const employee = this.state.employees.find(e => e.id === this.session.employeeId);
        if (!employee) return;
        const necHTML = get1099NECHTML(employee, this.state);
        this.openModal(`IRS Form 1099-NEC: ${employee.name}`, necHTML, true);
    },

    previewContractorReceiptFromId: function(employeeId, runId) {
        this.previewEmployeePaystubFromId(employeeId, runId);
    },

    showOnboardingDoc: function(type, name, filingStatus) {
        const html = `
            <div style="background-color:#fffdf5; border:1px solid #94a3b8; padding:30px; font-family:var(--font-body); border-radius:var(--radius-md); box-shadow:var(--shadow-lg);">
                <div style="display:flex; justify-content:space-between; border-bottom:2px solid #334155; padding-bottom:10px; margin-bottom:20px;">
                    <div>
                        <h2 style="font-family:var(--font-heading); color:#334155;">Form W-4 Withholding Allowance</h2>
                        <span style="font-size:12px; color:#64748b;">Department of the Treasury Internal Revenue Service</span>
                    </div>
                    <div style="font-weight:700; font-size:20px; color:#334155;">2026</div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; font-size:13px; line-height:1.6;">
                    <div>
                        <p><strong>Employee Name:</strong> ${name}</p>
                        <p><strong>Filing Status:</strong> ${filingStatus === 'married' ? 'Married Filing Jointly' : 'Single'}</p>
                        <p><strong>Security Number (SSN):</strong> XXX-XX-4928</p>
                    </div>
                    <div>
                        <p><strong>Federal Allowances:</strong> 0 (Standard withholding)</p>
                        <p><strong>Electronic Signature Status:</strong> Completed online</p>
                        <p><strong>Timestamp:</strong> Jan 04, 2026 09:14:02 UTC</p>
                    </div>
                </div>
                <div style="margin-top:30px; text-align:center; color:#64748b; font-size:11px; border-top:1px dashed #cbd5e1; padding-top:15px;">
                    This onboarding certification is securely stored. Changes must be reported to HR administrator.
                </div>
            </div>
        `;
        this.openModal(`IRS Form W-4 Certificate`, html, true);
    },

    calculateMyTimecardTotal: function() {
        const employeeId = this.session.employeeId;
        const employee = this.state.employees.find(e => e.id === employeeId);
        
        let total = 0;
        for (let idx = 0; idx < 7; idx++) {
            const input = document.getElementById(`myTimeDay-${idx}`);
            if (input) {
                total += parseFloat(input.value) || 0;
            }
        }

        const totalHrsEl = document.getElementById('myTimeTotalHrs');
        const breakdownEl = document.getElementById('myTimeBreakdownHrs');
        const estGrossEl = document.getElementById('myTimeEstGross');

        if (totalHrsEl) totalHrsEl.textContent = `${total.toFixed(2)} hrs`;

        // Overtime rule: hours exceeding 40 hours per week are calculated at 1.5x
        let reg = Math.min(40, total);
        let ot = Math.max(0, total - 40);

        if (breakdownEl) breakdownEl.textContent = `${reg.toFixed(2)}h Reg / ${ot.toFixed(2)}h OT`;

        // Estimate gross
        const estGross = (reg * employee.rate) + (ot * employee.rate * 1.5);
        if (estGrossEl) estGrossEl.textContent = formatCurrency(estGross);
    },

    saveMyTimesheet: async function() {
        const employeeId = this.session.employeeId;
        const hours = [];
        for (let idx = 0; idx < 7; idx++) {
            const input = document.getElementById(`myTimeDay-${idx}`);
            hours.push(input ? parseFloat(input.value) || 0 : 0);
        }
        try {
            await AeroDB.saveTimesheet(employeeId, hours);
            this.state.timesheets[employeeId] = hours;
            this.showToast('Timecard hours successfully logged and submitted.', 'success');
            this.navigateTo('employee-dashboard');
        } catch (err) { this.showToast('Failed to save timecard: ' + err.message, 'danger'); }
    },

    _hasSignatureStrokes: function() {
        const canvas = window._w2SignCanvas;
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return data.some(v => v !== 0);
    },

    saveDirectDepositSplit: async function(e) {
        e.preventDefault();
        const employeeId = this.session.employeeId;
        const enabled        = document.getElementById('splitEnabled').checked;
        const savingsPercent = parseFloat(document.getElementById('splitSavingsPercent').value) || 0;
        const savingsRouting = document.getElementById('splitSavingsRouting').value;
        const savingsAccount = document.getElementById('splitSavingsAccount').value;
        const emp = this.state.employees.find(x => x.id === employeeId);
        if (!emp) return;
        const updated = { ...emp, splitDeposits: { enabled, savingsPercent, savingsRouting, savingsAccount } };
        try {
            await AeroDB.updateEmployee(employeeId, updated);
            this.state.employees[this.state.employees.indexOf(emp)] = updated;
            this.showToast('Direct deposit preferences updated successfully.', 'success');
            this.navigateTo('employee-dashboard');
        } catch (err) { this.showToast('Failed to save deposit settings: ' + err.message, 'danger'); }
    },

    requestPayAdvance: async function(e) {
        e.preventDefault();
        const employeeId = this.session.employeeId;
        const amount = parseFloat(document.getElementById('advanceReqAmount').value) || 0;
        if (amount <= 0 || amount > 200) { this.showToast('Please request an amount between $10 and $200.', 'warning'); return; }
        if (this.state.payAdvances.some(a => a.empId === employeeId && (a.status === 'pending' || a.status === 'approved'))) {
            this.showToast('You already have an outstanding pay advance request.', 'danger'); return;
        }
        try {
            await AeroDB.requestPayAdvance(employeeId, amount);
            this.state.payAdvances = await AeroDB.getPayAdvances();
            this.showToast(`Pay advance of ${formatCurrency(amount)} requested successfully.`, 'success');
            this.navigateTo('employee-dashboard');
        } catch (err) { this.showToast('Failed to request advance: ' + err.message, 'danger'); }
    },

    approvePayAdvance: async function(advId) {
        try {
            await AeroDB.approvePayAdvance(advId);
            this.state.payAdvances = await AeroDB.getPayAdvances();
            this.showToast('Pay advance approved successfully.', 'success');
            this.navigateTo('approvals');
        } catch (err) { this.showToast('Failed to approve advance: ' + err.message, 'danger'); }
    },

    denyPayAdvance: async function(advId) {
        try {
            await AeroDB.denyPayAdvance(advId);
            this.state.payAdvances = await AeroDB.getPayAdvances();
            this.showToast('Pay advance request denied.', 'info');
            this.navigateTo('approvals');
        } catch (err) { this.showToast('Failed to deny advance: ' + err.message, 'danger'); }
    },

    openGarnishmentsModal: function(employeeId) {
        const emp = this.state.employees.find(e => e.id === employeeId);
        if (!emp) return;

        emp.garnishments = emp.garnishments || [];

        let listHTML = '';
        if (emp.garnishments.length === 0) {
            listHTML = `<p style="color:var(--text-tertiary); text-align:center; padding:12px;">No active court garnishments found.</p>`;
        } else {
            listHTML = `
                <table class="table-responsive" style="margin-bottom:20px; width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom:1px solid var(--border-color);">
                            <th style="padding:8px 0; text-align:left;">Case #</th>
                            <th style="padding:8px 0; text-align:left;">Type</th>
                            <th style="padding:8px 0; text-align:left;">Amount/Run</th>
                            <th style="padding:8px 0; text-align:left;">Limit</th>
                            <th style="padding:8px 0; text-align:left;">YTD Withheld</th>
                            <th style="padding:8px 0; text-align:right;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${emp.garnishments.map(g => `
                            <tr style="border-bottom:1px solid var(--border-color);">
                                <td style="padding:8px 0;"><strong>${g.caseNumber}</strong></td>
                                <td style="padding:8px 0;">${g.type}</td>
                                <td style="padding:8px 0;">${formatCurrency(g.amount)}</td>
                                <td style="padding:8px 0;">${g.limit ? formatCurrency(g.limit) : 'No Limit'}</td>
                                <td style="padding:8px 0;">${formatCurrency(g.ytdDeducted || 0)}</td>
                                <td style="padding:8px 0; text-align:right;">
                                    <button class="btn btn-sm-icon btn-danger-hover" onclick="AeroApp.deleteGarnishment('${employeeId}', '${g.id}')" title="Delete">
                                        <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        const modalHTML = `
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom:12px; font-family:var(--font-heading);">Active Garnishments for ${emp.name}</h4>
                ${listHTML}
            </div>
            
            <hr style="border:0; border-top:1px dashed var(--border-color); margin:20px 0;"/>
            
            <form id="addGarnishmentForm" onsubmit="AeroApp.handleAddGarnishment(event, '${employeeId}')">
                <h4 style="margin-bottom:12px; font-family:var(--font-heading);">Add Court Withholding Order</h4>
                <div class="form-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                    <div class="form-group">
                        <label for="garnCaseNumber">Case Number</label>
                        <input type="text" class="form-control" id="garnCaseNumber" required placeholder="e.g. CS-2026-991">
                    </div>
                    <div class="form-group">
                        <label for="garnType">Withholding Type</label>
                        <select class="form-control" id="garnType">
                           <option value="Child Support">Child Support</option>
                           <option value="Creditor Garnishment">Creditor Garnishment</option>
                           <option value="Federal Tax Levy">Federal Tax Levy</option>
                           <option value="Student Loan">Student Loan</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="garnAmount">Withholding Amount ($ per run)</label>
                        <input type="number" step="any" class="form-control" id="garnAmount" required placeholder="e.g. 150">
                    </div>
                    <div class="form-group">
                        <label for="garnLimit">Total Maximum Limit ($)</label>
                        <input type="number" step="any" class="form-control" id="garnLimit" placeholder="e.g. 5000 (Optional)">
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:24px;">
                    <button type="button" class="btn btn-secondary" onclick="AeroApp.closeModal()">Close</button>
                    <button type="submit" class="btn btn-primary">Add Withholding Order</button>
                </div>
            </form>
        `;

        this.openModal(`Manage Garnishments: ${emp.name}`, modalHTML, true);
    },

    handleAddGarnishment: async function(e, employeeId) {
        e.preventDefault();
        const emp = this.state.employees.find(x => x.id === employeeId);
        if (!emp) return;
        const garn = {
            caseNumber: document.getElementById('garnCaseNumber').value,
            type:       document.getElementById('garnType').value,
            amount:     parseFloat(document.getElementById('garnAmount').value) || 0,
            limit:      document.getElementById('garnLimit').value ? parseFloat(document.getElementById('garnLimit').value) : undefined,
        };
        try {
            const newId = await AeroDB.addGarnishment(employeeId, garn);
            emp.garnishments = emp.garnishments || [];
            emp.garnishments.push({ ...garn, id: newId, ytdDeducted: 0 });
            this.showToast(`Withholding order added for ${emp.name}`, 'success');
            this.openGarnishmentsModal(employeeId);
        } catch (err) { this.showToast('Failed to add garnishment: ' + err.message, 'danger'); }
    },

    deleteGarnishment: async function(employeeId, garnId) {
        const emp = this.state.employees.find(x => x.id === employeeId);
        if (!emp || !emp.garnishments) return;
        try {
            await AeroDB.deleteGarnishment(garnId);
            emp.garnishments = emp.garnishments.filter(g => g.id !== garnId);
            this.showToast('Withholding order removed.', 'danger');
            this.openGarnishmentsModal(employeeId);
        } catch (err) { this.showToast('Failed to remove garnishment: ' + err.message, 'danger'); }
    }
};

// Start application on load
window.addEventListener('DOMContentLoaded', () => {
    AeroApp.init();
});
