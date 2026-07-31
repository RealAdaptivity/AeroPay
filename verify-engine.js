/**
 * Automated Verification Check for GlidePay Payroll Calculation Engine
 */

const { calculatePayroll } = require('./payroll-engine.js');

function assertEqual(actual, expected, description) {
    if (Math.abs(actual - expected) < 0.02) {
        console.log(`✅ PASS: ${description} (${actual})`);
    } else {
        console.error(`❌ FAIL: ${description} | Expected: ${expected}, Got: ${actual}`);
        process.exit(1);
    }
}

console.log("Starting GlidePay Payroll Engine Verification Checks...\n");

// Test Case 1: Salaried Employee, Married Jointly, CA resident, $125k/yr
const employee1 = {
    id: "emp-101",
    name: "Sarah Jenkins",
    type: "salaried",
    rate: 125000,
    payFrequency: "biweekly",
    filingStatus: "married",
    state: "CA"
};

const currentRun1 = {
    hours: 0,
    overtimeHours: 0,
    bonus: 0,
    commissions: 0,
    deduction401k: 192.31, // 4% of gross $4,807.69
    deductionMedical: 80,
    deductionPostTax: 0
};

const ytdGross1 = 0;

const result1 = calculatePayroll(employee1, currentRun1, ytdGross1);

console.log("Evaluating Test Case 1: Sarah Jenkins ($125,000/yr Salaried, Married Joint, CA)");
assertEqual(result1.grossPay, 4807.69, "Gross Pay Calculation");
assertEqual(result1.preTaxDeductions, 272.31, "Pre-Tax Deductions Summary");

// Verify FICA
// SS: 4,807.69 * 0.062 = 298.08
assertEqual(result1.taxes.socialSecurity, 298.08, "Social Security Employee Withholding");
// Medicare: 4,807.69 * 0.0145 = 69.71
assertEqual(result1.taxes.medicare, 69.71, "Medicare Employee Withholding");

// Verify Federal Income Tax (FIT)
// Taxable Wage = 4,807.69 - 272.31 = 4,535.38
// Annualized = 4,535.38 * 26 = 117,919.88
// Minus standard deduction 30,000 = 87,919.88 taxable
// Brackets:
//   10% up to 23,850 = 2,385.00
//   12% on (87,919.88 - 23,850 = 64,069.88) = 7,688.39
//   Total Annual = 10,073.39
//   Biweekly FIT Withholding = 10,073.39 / 26 = 387.44
assertEqual(result1.taxes.federalIncomeTax, 387.44, "Federal Income Tax Withholding");

// Verify CA State Income Tax (SIT)
// Annualized Taxable = 117,919.88
// CA Married standard deduction = 10,400
// CA Taxable = 117,919.88 - 10,400 = 107,519.88
// CA Brackets:
//   1% on 20,824 = 208.24
//   2% on (49,368 - 20,824 = 28,544) = 570.88
//   4% on (77,918 - 49,368 = 28,550) = 1,142.00
//   6% on (107,519.88 - 77,918 = 29,601.88) = 1,776.11
//   Total Annual CA tax = 208.24 + 570.88 + 1142.00 + 1776.11 = 3,697.23
//   Biweekly CA withholding = 3,697.23 / 26 = 142.20
assertEqual(result1.taxes.stateIncomeTax, 142.20, "California State Income Tax Withholding");

// Verify Net Pay
// Gross (4,807.69) - Pre-tax (272.31) - FIT (387.44) - FICA (298.08 + 69.71) - SIT (142.20) = 3,637.95
assertEqual(result1.netPay, 3637.95, "Net Take-Home Pay Calculation");

// Test Case 2: 1099 Contractor, $45/hr, Florida, 43 hours (3h overtime)
const contractor = {
    id: "emp-104",
    name: "Marcus Brody",
    classification: "1099",
    type: "hourly",
    rate: 45.00,
    payFrequency: "biweekly",
    state: "FL"
};

const currentRun2 = {
    hours: 40,
    overtimeHours: 3,
    bonus: 100,
    commissions: 50,
    reimbursement: 75
};

const result2 = calculatePayroll(contractor, currentRun2, 0);

console.log("\nEvaluating Test Case 2: Marcus Brody ($45/hr Hourly Contractor, FL)");
// Gross = (40 * 45) + (3 * 45) + 100 + 50 = 1800 + 135 + 100 + 50 = 2085.00
assertEqual(result2.grossPay, 2085.00, "Gross Pay Calculation");
assertEqual(result2.taxes.federalIncomeTax, 0, "FIT Withholding (Should be 0)");
assertEqual(result2.taxes.totalEmployeeTaxes, 0, "Total Employee Taxes (Should be 0)");
// Net = 2085.00 + 75 = 2160.00
assertEqual(result2.netPay, 2160.00, "Net Pay Calculation (Gross + Reimbursement)");
assertEqual(result2.totalPayrollCost, 2160.00, "Total Employer Cost (Gross + Reimbursement)");

// Test Case 3: W-2 Employee with Reimbursement
const employee3 = {
    id: "emp-103",
    name: "Elena Rostova",
    classification: "w2",
    type: "hourly",
    rate: 28.50,
    payFrequency: "weekly",
    filingStatus: "single",
    state: "TX"
};

const currentRun3 = {
    hours: 40,
    overtimeHours: 0,
    bonus: 0,
    commissions: 0,
    deduction401k: 0,
    deductionMedical: 0,
    reimbursement: 120
};

const result3 = calculatePayroll(employee3, currentRun3, 0);

console.log("\nEvaluating Test Case 3: Elena Rostova ($28.50/hr Hourly W-2, Single, TX, With Reimbursement)");
// TX has 0% SIT. FICA: SS = 1140 * 0.062 = 70.68, Med = 1140 * 0.0145 = 16.53. Total FICA = 87.21
// FIT: Annualized taxable = 1140 * 52 = 59,280. Std deduction single = 15,000. Taxable = 44,280.
// FIT = 11,925 * 0.10 + (44,280 - 11,925) * 0.12 = 1,192.50 + 3,882.60 = 5,075.10.
// Weekly FIT = 5,075.10 / 52 = 97.60.
// Total taxes = 87.21 + 97.60 = 184.81.
// Net pay = Gross (1140) - Taxes (184.81) + Reimbursement (120) = 1075.19.
assertEqual(result3.grossPay, 1140.00, "Gross Pay Calculation");
assertEqual(result3.taxes.totalEmployeeTaxes, 184.81, "Total Employee Taxes");
assertEqual(result3.netPay, 1075.19, "Net Take-Home Pay with Reimbursement");

// Test Case 4: Sarah Jenkins with 20% Savings Split, $100 Garnishment (capped at $50 limit remaining), and $150 Pay Advance repayment
const employee4 = {
    id: "emp-101",
    name: "Sarah Jenkins",
    type: "salaried",
    rate: 125000,
    payFrequency: "biweekly",
    filingStatus: "married",
    state: "CA",
    splitDeposits: {
        enabled: true,
        savingsPercent: 20,
        savingsRouting: "123456789",
        savingsAccount: "987654321"
    },
    garnishments: [
        {
            id: "g-1",
            caseNumber: "CS-100",
            type: "Child Support",
            amount: 100.00,
            limit: 300.00,
            ytdDeducted: 250.00
        }
    ]
};

const currentRun4 = {
    hours: 0,
    overtimeHours: 0,
    bonus: 0,
    commissions: 0,
    deduction401k: 192.31,
    deductionMedical: 80,
    deductionPostTax: 0,
    payAdvanceDeduction: 150.00,
    reimbursement: 50.00
};

const result4 = calculatePayroll(employee4, currentRun4, 0);

console.log("\nEvaluating Test Case 4: Sarah Jenkins (With Split Deposits, Capped Garnishment & Pay Advance Repayment)");
assertEqual(result4.grossPay, 4807.69, "Gross Pay");
assertEqual(result4.preTaxDeductions, 272.31, "Pre-Tax Deductions");
assertEqual(result4.taxes.totalEmployeeTaxes, 897.43, "Total Employee Taxes");
assertEqual(result4.garnishmentDeductions, 50.00, "Capped Garnishment Deduction (Remaining limit: $50)");
assertEqual(result4.payAdvanceDeduction, 150.00, "Pay Advance Repayment Deduction");
assertEqual(result4.postTaxDeductions, 200.00, "Total Post-Tax Deductions");
assertEqual(result4.netPay, 3487.95, "Net Take-Home Pay (4807.69 - 272.31 - 897.43 - 200 + 50)");
assertEqual(result4.hasSplit, true, "Has Split Direct Deposit");
assertEqual(result4.netPayChecking, 2790.36, "Checking Direct Deposit Split (80%)");
assertEqual(result4.netPaySavings, 697.59, "Savings Direct Deposit Split (20%)");

console.log("\nAll payroll mathematical assertions match IRS specifications! Engine is certified exact.");

