document.addEventListener('DOMContentLoaded', function () {

    // ============= TOAST NOTIFICATION SYSTEM =============
    function showToast(message, type = 'info', duration = 3200) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }[type] || 'ℹ️';
        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

    // ============= CONFIRM DIALOG SYSTEM =============
    function showConfirm(message, onConfirm) {
        const overlay = document.getElementById('confirm-overlay');
        const msgEl = document.getElementById('confirm-message');
        if (!overlay || !msgEl) { if (confirm(message)) onConfirm(); return; }
        msgEl.textContent = message;
        overlay.classList.add('active');

        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');

        const cleanup = () => overlay.classList.remove('active');
        const onYes = () => { cleanup(); onConfirm(); yesBtn.removeEventListener('click', onYes); noBtn.removeEventListener('click', onNo); };
        const onNo  = () => { cleanup(); yesBtn.removeEventListener('click', onYes); noBtn.removeEventListener('click', onNo); };

        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    }

    // ============= CREDIT CARD "LAST UPDATED" STAMP =============
    function formatStampDate(date) {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    }

    function loadCardsUpdatedDate() {
        const cardsDateEl = document.getElementById('cards-as-of-date');
        if (!cardsDateEl) return;
        const saved = localStorage.getItem('cardsLastUpdated');
        if (saved) {
            cardsDateEl.textContent = `(updated as of ${saved})`;
        } else {
            cardsDateEl.textContent = '(not yet stamped — click "Mark as Updated Today")';
            cardsDateEl.style.fontStyle = 'italic';
        }
    }

    const markBtn = document.getElementById('markCardsUpdatedBtn');
    if (markBtn) {
        markBtn.addEventListener('click', () => {
            const stamp = formatStampDate(new Date());
            localStorage.setItem('cardsLastUpdated', stamp);
            loadCardsUpdatedDate();
            const cardsDateEl = document.getElementById('cards-as-of-date');
            if (cardsDateEl) cardsDateEl.style.fontStyle = '';
            showToast(`Credit card data stamped as updated on ${stamp}`, 'success');
        });
    }

    loadCardsUpdatedDate();
    // ============================================================
    // --- DOM Element References ---
    const debtTableBody = document.getElementById('bank-a-debts');
    const summarySection = document.querySelector('.summary-section');
    const totalEmiElement = document.getElementById('total-emi');
    const totalRemainingElement = document.getElementById('total-remaining');
    const totalLoansElement = document.getElementById('loans');
    const totalLoanAmountElement = document.getElementById('total-loan');
    const loanBoxesContainer = document.querySelector('.loan-boxes-container');
    const overallProgressBar = document.querySelector('.overall-progress-bar');
    const overallProgressPercentage = document.querySelector('.overall-progress-percentage');
    const overallProgressRaised = document.querySelector('.overall-progress-amounts .overall-progress-raised');
    const overallProgressTotal = document.querySelector('.overall-progress-amounts .overall-progress-total');
    const loanProgressChartContainer = document.querySelector('.loan-progress-chart-container');
    const loanChartCanvas = document.getElementById('loanChart');
    const creditCardSimpleTbody = document.getElementById('credit-card-simple-tbody');
    const autoDebitLoansList = document.getElementById('auto-debit-loans-list');
    const topLoansList = document.getElementById('top-loans-list');
    const totalInterestElement = document.getElementById('total-interest');
    const totalPrincipalElement = document.getElementById('total-principal');
    const overallProgressSection = document.querySelector('.overall-progress-section');
    const loanBreakdownChartCanvas = document.getElementById('loanBreakdownChart');
    const emiForecastSection = document.querySelector('.emi-forecast-section');
    const debtByBankList = document.getElementById('debt-by-bank-list'); // New reference for debt by bank list
    const totalActiveEmiElement = document.getElementById('total-active-emi');
    const emiFreedomDateElement = document.getElementById('emi-freedom-date');
    const completedLoansElement = document.getElementById('completed-loans');
    const activeLoansElement = document.getElementById('active-loans');


    // --- Foreclosure Calculator References ---
    const foreclosureModal = document.getElementById('foreclosureModal');
    const foreclosureChargesInput = document.getElementById('foreclosureCharges');
    const foreclosureGSTInput = document.getElementById('foreclosureGST');
    const foreclosureWarning = document.getElementById('foreclosureWarning');
    const remainingPrincipalDisplay = document.getElementById('remainingPrincipalDisplay');
    const chargesPercentDisplay = document.getElementById('chargesPercentDisplay');
    const chargesAmountDisplay = document.getElementById('chargesAmountDisplay');
    const gstPercentDisplay = document.getElementById('gstPercentDisplay');
    const gstAmountDisplay = document.getElementById('gstAmountDisplay');
    const totalForeclosureAmountDisplay = document.getElementById('totalForeclosureAmountDisplay');
    const interestSavedDisplay = document.getElementById('interestSavedDisplay');
    const monthsPendingDisplay = document.getElementById('monthsPendingDisplay');
    const interestPaidDisplay = document.getElementById('interestPaidDisplay');
    const totalInterestDisplay = document.getElementById('totalInterestDisplay');



    let selectedLoanData = null; // To store data of the loan being calculated




    const btn = document.getElementById('calculateForeclosure');
    if (btn) btn.addEventListener('click', calculateForeclosure);


    // --- Constants and Initial Variables ---
    const indianRupeeOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
    const topLoansCount = 3;
    let totalInterestForAllLoans = 0;
    let totalPrincipalForAllLoans = 0;
    let currentLoanData = []; // Store processed loan data globally

    // --- Bank Logo Mapping (Placeholder Images) ---
    const bankLogos = { "IDFC BANK": "images/idfc.png", "SBI BANK": "images/sbi.png", "ICICI BANK": "images/icicibank.png", "KOTAK BANK": "images/kotakbank.png", "DMI FINANCE": "images/dmifinance.png", "AXIS BANK": "images/axisbank.png", "RBL BANK": "images/rblbank.png", "CREDIT SAISON": "images/creditsaison.png", "INDUSIND BANK": "images/indusindbank.png", "HDFC BANK": "images/hdfcbank.png" };


    const BANK_FORECLOSURE_RULES = {
        "AXIS BANK": "<b>12 MONTH CHECK</b> <br>PERSONAL LOAN - if emis paid less than or equal to 36 months then 3% else 2%<br>CREDIT CARD - 3% of outstanding. ",
        "CREDIT SAISON": "<b>NO 12 MONTH CHECK</b> <br>PERSONAL LOAN <br>1. Up to 12th emi - 6% of outstanding. <br>2.From 13th emi to 24th emi - 4% of outstanding. <br>3.From 25th emi - 3% of outstanding.",
        "DMI FINANCE": "<b>12 MONTH CHECK</b> <br>PERSONAL LOAN - 3% of outstanding.",
        "ICICI BANK": "<br>CREDIT CARD - 3% of outsatanding.",
        "IDFC BANK": "<b>12 MONTH CHECK</b> <br>PERSONAL LOAN - 4% of outstanding<br>CREDIT CARD - 3% of outstanding.",
        "INDUSIND BANK": "<b>12 MONTH CHECK</b> <br>PERSONAL LOAN - 4% of outstanding <br>CREDIT CARD - 3% of outstanding.",
        "KOTAK BANK": "<b>NO 12 MONTH CHECK</b> <br>PERSONAL LOAN - if emis paid less than or equal to 36 months then 4% else 2% <br>CREDIT CARD - 0% or 4% of outstanding. ",
        "RBL BANK": "<b>12 MONTH CHECK</b> <br>PERSONAL LOAN - if emis paid less than 18 emis then 5% else 3% <br>CREDIT CARD - 3% of the outstanding.",
        "SBI BANK": "<br>CREDIT CARD - FLEXIPAY AND ENCASH - 3% of outstanding",
        "Default": "<br>Foreclosure charges typically range from 2% to 5% of the outstanding principal.<br>Consult your loan agreement for exact details."
    };



    // --- Credit Card Data (Detailed) ---
    const creditCardData1 = [
         {
            name: "IndusInd Legend",
            totalLimit: 50000,
            currentOutstanding: 31711,
            billingCycleEndDay: 15,
            paymentDueDay: 4
        },
        {
            name: "ICICI AmazonPay",
            totalLimit: 140000,
            currentOutstanding: 5139,
            billingCycleEndDay: 28,
            paymentDueDay: 15
        },
        {
            name: "SBI SimplyCLICK",
            totalLimit: 131000,
            currentOutstanding: 48823,
            billingCycleEndDay: 11,
            paymentDueDay: 30
        },
        {
            name: "IDFC First Classic",
            totalLimit: 52000,
            currentOutstanding: 18966,
            billingCycleEndDay: 19,
            paymentDueDay: 3
        },
        {
            name: "RBL SuperCard",
            totalLimit: 149000,
            currentOutstanding: 0,
            billingCycleEndDay: 12,
            paymentDueDay: 1
        },
        {
            name: "Flipkart Axis",
            totalLimit: 180000,
            currentOutstanding: 7812,
            billingCycleEndDay: 13,
            paymentDueDay: 1
        },
        {
            name: "Kotak League Card",
            totalLimit: 200000,
            currentOutstanding: 40457,
            billingCycleEndDay: 25,
            paymentDueDay: 13
        }
    ];

    const creditCardsGrid = document.getElementById('credit-cards-grid');
    const noCreditCardsMessage = document.querySelector('.no-credit-cards-message');
    const totalCreditLimitElement = document.getElementById('totalCreditLimit');
    const totalAvailableLimitElement = document.getElementById('totalAvailableLimit');
    const totalOutstandingElement = document.getElementById('totalOutstanding');






    // --- Helper Functions ---

    /**
     * Calculates the remaining principal for a loan after a number of EMIs (reducing balance).
     * Formula derived from: P * [(1 + r)^n - (1 + r)^p] / [(1 + r)^n - 1]
     * where:
     * P = Initial Principal Amount
     * r = Monthly Interest Rate (annual rate / 1200)
     * n = Total Tenure (months)
     * p = Months Paid
     * * @param {number} principal - Initial Principal Amount.
     * @param {number} annualRate - Annual Interest Rate (e.g., 10.5 for 10.5%).
     * @param {number} emi - Monthly EMI amount (used as a check, not in the main formula).
     * @param {number} monthsPaid - Number of EMIs already paid.
     * @param {number} totalTenure - Total tenure of the loan in months. (Added to function params)
     * @returns {number} The remaining principal amount.
     */
    function calculateRemainingPrincipal(principal, annualRate, emi, monthsPaid, totalTenure) {
        if (monthsPaid <= 0) return principal;
        if (monthsPaid >= totalTenure) return 0;

        const monthlyRate = annualRate / 1200; // r

        // If monthlyRate is 0 (interest-free loan, which is unlikely but a mathematical check)
        if (monthlyRate === 0) {
            const principalPaid = (principal / totalTenure) * monthsPaid;
            return Math.max(0, principal - principalPaid);
        }

        // This calculates the initial Principal from the EMI (P = EMI * [1 - (1 + r)^-n] / r)
        // Since we have the actual principal, we use the remaining principal formula:
        // Remaining Principal = P * (1+r)^p - (EMI/r) * ((1+r)^p - 1)

        const onePlusRToTheP = Math.pow(1 + monthlyRate, monthsPaid);

        let remainingPrincipal = (principal * onePlusRToTheP) - ((emi / monthlyRate) * (onePlusRToTheP - 1));

        return Math.max(0, Math.round(remainingPrincipal)); // Round to nearest rupee and ensure non-negative
    }

    /**
     * Formats a date with a day suffix (e.g., 1st, 2nd, 3rd, 4th).
     * @param {number} day - The day of the month.
     * @returns {string} The day with its appropriate suffix.
     */
    function formatDateSuffix(day) {
        if (day >= 11 && day <= 13) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    /**
     * Formats a date into a readable string (e.g., "19th Sep 2025").
     * @param {number} year - The full year.
     * @param {number} month - The month (1-indexed).
     * @param {number} day - The day of the month.
     * @returns {string} The formatted date string.
     */
    const formatDate = (year, month, day) => {
        const date = new Date(year, month - 1, day);
        const dayNum = date.getDate();
        const monthShort = date.toLocaleString('default', { month: 'short' });
        const yearFull = date.getFullYear();
        const suffix = formatDateSuffix(dayNum);
        return `${dayNum}${suffix} ${monthShort} ${yearFull}`;
    };

    /**
     * Calculates time components (years, months, days, etc.) between two dates.
     * @param {Date} from - The start date.
     * @param {Date} to - The end date.
     * @returns {{years: number, months: number, days: number, hours: number, minutes: number, seconds: number}} Time components.
     */
    function getTimeComponents(from, to) {
        let years = to.getFullYear() - from.getFullYear();
        let months = to.getMonth() - from.getMonth();
        let days = to.getDate() - from.getDate();
        let hours = to.getHours() - from.getHours();
        let minutes = to.getMinutes() - from.getMinutes();
        let seconds = to.getSeconds() - from.getSeconds();

        if (seconds < 0) { seconds += 60; minutes--; }
        if (minutes < 0) { minutes += 60; hours--; }
        if (hours < 0) { hours += 24; days--; }
        if (days < 0) {
            const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
            days += prevMonth;
            months--;
        }
        if (months < 0) { months += 12; years--; }

        return { years, months, days, hours, minutes, seconds };
    }

    /**
     * Finds the maximum (latest) end date among all loans.
     * @returns {Date | null} The latest end date or null if no loans.
     */
    function getMaxEndDate() {
        let maxDate = null;
        const allRows = document.querySelectorAll('#bank-a-debts tr');
        allRows.forEach(row => {
            const endYear = parseInt(row.dataset.endYear);
            const endMonth = parseInt(row.dataset.endMonth) - 1;
            const endDay = parseInt(row.dataset.endDay) || 5;
            const endDate = new Date(endYear, endMonth, endDay, 23, 59, 59);

            if (!maxDate || endDate > maxDate) {
                maxDate = endDate;
            }
        });
        return maxDate;
    }

    /**
     * Updates the overall loan countdown timer display.
     */
    function updateOverallCountdown() {
        const endDate = getMaxEndDate();
        const now = new Date();

        if (!endDate || endDate < now) {
            document.getElementById('overallFreedomText').textContent = "🎉 Loan Free!";
            return;
        }

        const { years, months, days } = getTimeComponents(now, endDate);

        const compactText = `${years} years ${months} months ${days} days`;
        document.getElementById('overallFreedomText').textContent =
            `Freedom In : ${compactText}`;
    }



    /**
     * Opens the foreclosure calculator modal and populates it with loan data.
     * @param {Object} loan - The loan object from currentLoanData.
     */
    function openForeclosureCalculator(loan) {

        // --- CALCULATION FOR FORECLOSURE (Accurate Principal) ---
        // 1. Calculate the accurate remaining principal using the amortization formula
        const accurateRemainingPrincipal = calculateRemainingPrincipal(
            loan.principalAmount,
            loan.annualInterestRate,
            loan.emi,
            loan.monthsPassed,
            loan.tenureMonths
        );

        // 2. Store the accurate principal in the selectedLoanData for use in calculateForeclosure
        selectedLoanData = {
            ...loan,
            currentRemainingAmount: accurateRemainingPrincipal // Override with accurate value
        };
        // --------------------------------------------------------

        const monthsPaid = loan.monthsPassed;
        const monthsRemaining = loan.monthsRemaining || (loan.tenureMonths - monthsPaid); // Use existing or calculate

        // Use the ACCURATE principal for all calculations and display
        const remainingPrincipal = accurateRemainingPrincipal;

        const totalPayable = loan.emi * loan.tenureMonths;
        const totalPaid = loan.emi * monthsPaid;
        const totalInterest = totalPayable - loan.principalAmount; // Total full interest

        // Interest Paid so far (Total Paid - Principal Paid)
        const principalPaid = loan.principalAmount - remainingPrincipal;
        const interestPaid = Math.max(0, totalPaid - principalPaid); // Ensure non-negative
        const remainingInterest = Math.max(0, totalInterest - interestPaid); // Interest that would have been paid

        const estimatedTotalPendingAmount = monthsRemaining * loan.emi;


        // 1. Check if loan has completed 12 EMIs
        const isEligible = monthsPaid >= 12;

        // --- DOM Element References (for robust local use) ---
        const foreclosureModal = document.getElementById('foreclosureModal');
        const monthsPendingDisplay = document.getElementById('monthsPendingDisplay');
        const foreclosureWarning = document.getElementById('foreclosureWarning');
        const foreclosureChargesInput = document.getElementById('foreclosureCharges');
        const foreclosureGSTInput = document.getElementById('foreclosureGST');
        const chargesPercentDisplay = document.getElementById('chargesPercentDisplay');
        const chargesAmountDisplay = document.getElementById('chargesAmountDisplay');
        const gstPercentDisplay = document.getElementById('gstPercentDisplay');
        const gstAmountDisplay = document.getElementById('gstAmountDisplay');
        const totalForeclosureAmountDisplay = document.getElementById('totalForeclosureAmountDisplay');
        const interestPaidDisplay = document.getElementById('interestPaidDisplay');
        const interestSavedDisplay = document.getElementById('interestSavedDisplay');
        const totalInterestDisplay = document.getElementById('totalInterestDisplay');

        // --- NEW ---
        // Add a reference to your new totalSavingsDisplay element
        const totalSavingsDisplay = document.getElementById('totalSavingsDisplay');


        // Populate Details 

        // MOVED TO TOP: EMI Eligibility
        document.getElementById('emiEligibility').textContent = isEligible ? '✅ Eligible for Foreclosure (12+ EMIs paid)' : '❌ Not Eligible for Foreclosure (Less than 12 EMIs paid)';
        document.getElementById('emiEligibility').style.color = isEligible ? '#28a745' : '#dc3545';

        document.getElementById('foreclosureLoanBank').textContent = loan.bankName;
        document.getElementById('foreclosureLoanDescription').textContent = loan.description;
        document.getElementById('initialPrincipal').textContent = `₹ ${loan.principalAmount.toLocaleString('en-IN', indianRupeeOptions)}`;
        document.getElementById('emiAmountDisplay').textContent = `₹ ${loan.emi.toLocaleString('en-IN', indianRupeeOptions)}`;
        document.getElementById('monthsPaidDisplay').textContent = `${monthsPaid} months`;

        // NEW DISPLAY: Estimated Total Pending Amount
        // Assuming an element with this ID exists in your HTML below remainingPrincipalDisplay
        const estimatedTotalPendingDisplay = document.getElementById('estimatedTotalPendingDisplay');
        if (estimatedTotalPendingDisplay) {
            estimatedTotalPendingDisplay.textContent = `₹ ${estimatedTotalPendingAmount.toLocaleString('en-IN', indianRupeeOptions)}`;
        }

        // Display Bank-specific foreclosure rules
        const bankName = loan.bankName;
        const rule = BANK_FORECLOSURE_RULES[bankName] || BANK_FORECLOSURE_RULES['Default'];
        const ruleDisplay = document.getElementById('foreclosureChargesRuleDisplay');

        if (ruleDisplay) {
            ruleDisplay.innerHTML = `<p style="font-size:0.9em; color:#555;"><strong>${bankName} Rule:</strong> ${rule}</p>`;
        }

        // NEW: Months Pending
        if (monthsPendingDisplay) monthsPendingDisplay.textContent = `${monthsRemaining} months`;

        document.getElementById('remainingPrincipalDisplay').textContent = `₹ ${remainingPrincipal.toLocaleString('en-IN', indianRupeeOptions)}`;

        // Set initial values and reset results
        foreclosureWarning.style.display = isEligible ? 'none' : 'block';
        foreclosureWarning.innerHTML = `**Warning:** Most banks charge a higher foreclosure fee or do not allow foreclosure before 12 EMIs. The fee below may not apply. Proceed with caution.`;

        foreclosureChargesInput.value = ''; // Clear previous input
        foreclosureGSTInput.value = 18; // Default GST
        foreclosureGSTInput.disabled = true; // Make GST uneditable


        // Clear results
        chargesPercentDisplay.textContent = '0';
        chargesAmountDisplay.textContent = '₹ 0';
        gstPercentDisplay.textContent = '0';
        gstAmountDisplay.textContent = '₹ 0';
        totalForeclosureAmountDisplay.textContent = '₹ 0';

        // --- NEW ---
        // Also clear the total savings display
        if (totalSavingsDisplay) totalSavingsDisplay.textContent = '₹ 0';

        // NEW: Display estimated interest paid
        if (interestPaidDisplay) interestPaidDisplay.textContent = `₹ ${Math.max(0, interestPaid).toLocaleString('en-IN', indianRupeeOptions)}`;

        // Display estimated interest saved
        interestSavedDisplay.textContent = `₹ ${Math.max(0, remainingInterest).toLocaleString('en-IN', indianRupeeOptions)}`;

        // NEW: Display estimated interest before foreclosure (total interest)
        if (totalInterestDisplay) totalInterestDisplay.textContent = `₹ ${Math.max(0, totalInterest).toLocaleString('en-IN', indianRupeeOptions)}`;

        document.getElementById('foreclosureResults').style.display = 'none';

        // Show the modal
        foreclosureModal.style.display = 'block';
    }

    /**
     * Calculates the total foreclosure amount based on user inputs.
     */
    function calculateForeclosure() {
        if (!selectedLoanData) return;

        const remainingPrincipal = selectedLoanData.currentRemainingAmount;
        // User adds manually: Foreclosure Charges
        const chargesPercent = parseFloat(foreclosureChargesInput.value) || 0;

        // User adds manually: GST on Foreclosure Charges
        const gstPercent = parseFloat(foreclosureGSTInput.value) || 0; // Use 0 if not set, 18 is default in input

        // 1. Calculate Foreclosure Charges Amount
        const foreclosureChargesAmount = (remainingPrincipal * chargesPercent) / 100;

        // 2. Calculate GST Amount
        const gstAmount = (foreclosureChargesAmount * gstPercent) / 100;

        // 3. Calculate Total Foreclosure Amount (Remaining Principal + Charges + GST)
        const totalForeclosureAmount = remainingPrincipal + foreclosureChargesAmount + gstAmount;
        const totalForeclosureCharges = foreclosureChargesAmount + gstAmount;

        const totalChargesDisplay = document.getElementById('totalChargesDisplay');
        if (totalChargesDisplay) {
            totalChargesDisplay.textContent = `₹ ${totalForeclosureCharges.toLocaleString('en-IN', indianRupeeOptions)}`;
        }

        // Display results clearly
        chargesPercentDisplay.textContent = chargesPercent.toFixed(2);
        chargesAmountDisplay.textContent = `₹ ${foreclosureChargesAmount.toLocaleString('en-IN', indianRupeeOptions)}`;
        gstPercentDisplay.textContent = gstPercent.toFixed(2);
        gstAmountDisplay.textContent = `₹ ${gstAmount.toLocaleString('en-IN', indianRupeeOptions)}`;
        totalForeclosureAmountDisplay.textContent = `₹ ${totalForeclosureAmount.toLocaleString('en-IN', indianRupeeOptions)}`;

        // --- NEW ---
        // Calculate and display Total Savings
        const monthsRemaining = selectedLoanData.monthsRemaining || (selectedLoanData.tenureMonths - selectedLoanData.monthsPassed);
        const estimatedTotalPendingAmount = selectedLoanData.emi * monthsRemaining;
        const totalSavings = estimatedTotalPendingAmount - totalForeclosureAmount;

        const totalSavingsDisplay = document.getElementById('totalSavingsDisplay');
        if (totalSavingsDisplay) {
            // Add styling as needed, e.g., a "saved" class
            totalSavingsDisplay.textContent = `₹ ${totalSavings.toLocaleString('en-IN', indianRupeeOptions)}`;
        }
        // --- END NEW ---

        document.getElementById('foreclosureResults').style.display = 'block';

    }
    function getBankLogoFromCard(cardName) {
        cardName = cardName.toUpperCase();

        if (cardName.includes("KOTAK")) return bankLogos["KOTAK BANK"];
        if (cardName.includes("AXIS")) return bankLogos["AXIS BANK"];
        if (cardName.includes("ICICI")) return bankLogos["ICICI BANK"];
        if (cardName.includes("RBL")) return bankLogos["RBL BANK"];
        if (cardName.includes("INDUSIND")) return bankLogos["INDUSIND BANK"];
        if (cardName.includes("SBI")) return bankLogos["SBI BANK"];
        if (cardName.includes("CREDIT")) return bankLogos["CREDIT SAISON"];
        if (cardName.includes("IDFC")) return bankLogos["IDFC BANK"];

        return "bank.png"; // fallback
    }

    // --- Credit Card Overview and Grid Population ---
    function populateCreditCards() {
        if (!creditCardData1 || creditCardData1.length === 0) {
            noCreditCardsMessage.style.display = "block";
            totalCreditLimitElement.textContent = "₹ 0";
            totalAvailableLimitElement.textContent = "₹ 0";
            totalOutstandingElement.textContent = "₹ 0";
            return;
        }

        noCreditCardsMessage.style.display = "none";

        const today = new Date();

        let totalLimit = 0;
        let totalOutstanding = 0;

        creditCardData1.forEach(card => {
            totalLimit += card.totalLimit;
            totalOutstanding += card.currentOutstanding;
        });

        const totalAvailable = totalLimit - totalOutstanding;

        totalCreditLimitElement.textContent = `₹ ${totalLimit.toLocaleString("en-IN")}`;
        totalAvailableLimitElement.textContent = `₹ ${totalAvailable.toLocaleString("en-IN")}`;
        totalOutstandingElement.textContent = `₹ ${totalOutstanding.toLocaleString("en-IN")}`;

        // Sort cards by highest utilization first (danger first)
        const processedCards = creditCardData1.map(card => {
            const available = card.totalLimit - card.currentOutstanding;
            const utilization = (card.currentOutstanding / card.totalLimit) * 100;
            const safeLimit = card.totalLimit * 0.30;
            const overuse = Math.max(0, card.currentOutstanding - safeLimit);

            // Risk level
            let risk = "Low";
            if (utilization > 50) risk = "High";
            else if (utilization > 30) risk = "Medium";

            // Due date
            let dueDate = new Date(today.getFullYear(), today.getMonth(), card.paymentDueDay);
            if (dueDate < today) dueDate.setMonth(dueDate.getMonth() + 1);
            const daysToDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

            return {
                ...card,
                available,
                utilization,
                risk,
                daysToDue,
                overuse
            };
        });

        processedCards.sort((a, b) => b.utilization - a.utilization);

        creditCardsGrid.innerHTML = "";

        processedCards.forEach(card => {
            const cardBox = document.createElement("div");
            cardBox.className = "credit-card-box";

            let barColor = "#16a34a"; // green
            if (card.utilization > 60) barColor = "#dc2626";
            else if (card.utilization > 30) barColor = "#f59e0b";

            cardBox.innerHTML = `
            <div class="credit-card-header">
                <h3>${card.name}</h3>
                <img src="${getBankLogoFromCard(card.name)}" class="credit-bank-logo" />
            </div>
            
            <div class="credit-row">
                <span>Total Limit</span>
                <span>₹ ${card.totalLimit.toLocaleString("en-IN")}</span>
            </div>

            <div class="credit-row">
                <span>Available</span>
                <span class="credit-available">₹ ${card.available.toLocaleString("en-IN")}</span>
            </div>

            <div class="credit-row">
                <span>Outstanding</span>
                <span class="credit-outstanding">₹ ${card.currentOutstanding.toLocaleString("en-IN")}</span>
            </div>

            <div class="credit-progress">
                <div class="credit-progress-fill" style="width:${card.utilization.toFixed(1)}%; background:${barColor};"></div>
            </div>

            <div class="credit-used">${card.utilization.toFixed(1)}% Used</div>

            <div class="credit-footer">
                <span>Due in ${card.daysToDue} days</span>
                <span class="risk-${card.risk.toLowerCase()}">${card.risk} Risk</span>
            </div>
        `;

            creditCardsGrid.appendChild(cardBox);
        });
    }

    // --- Credit Card Billing Cycle Table Population ---
    function populateCreditCardTable() {
        const creditCardData = [
            { name: "SBI BANK", billingCycle: "11th - 30th", interestRate: "16" },
            { name: "RBL BANK", billingCycle: "12th - 1st", interestRate: "21" },
            { name: "AXIS BANK", billingCycle: "13th - 1st", interestRate: "18" },
            { name: "INDUSIND BANK", billingCycle: "15th - 04th", interestRate: "17" },
            { name: "IDFC BANK", billingCycle: "19th - 3rd", interestRate: "21" },
            { name: "KOTAK BANK", billingCycle: "25th - 13th", interestRate: "19" },
            { name: "ICICI BANK", billingCycle: "28th - 15th", interestRate: "17" }
        ];

        creditCardSimpleTbody.innerHTML = ''; // Clear existing rows
        creditCardData.forEach(card => {
            const row = creditCardSimpleTbody.insertRow();
            row.insertCell().textContent = card.name;
            row.insertCell().textContent = card.billingCycle;
            const rate = parseFloat(card.interestRate);
            let cls = "interest-low";
            if (rate >= 20) cls = "interest-high";
            else if (rate >= 17) cls = "interest-medium";

            const rateCell = row.insertCell();
            rateCell.innerHTML = `<span class="${cls}">${card.interestRate}%</span>`;

        });
    }

    // --- Auto Debit Loans List Population (Dynamic) ---
    function populateAutoDebitLoans() {
        if (!autoDebitLoansList) return;

        // Use live currentLoanData — only active loans
        const activeLoans = currentLoanData.filter(l => l.monthsRemaining > 0);

        // Group by emiDay
        const grouped = {};
        activeLoans.forEach(loan => {
            const day = loan.emiDay;
            if (!grouped[day]) grouped[day] = { day, loans: [], total: 0 };
            grouped[day].loans.push(loan);
            grouped[day].total += loan.emi;
        });

        // Sort groups by day ascending
        const sortedGroups = Object.values(grouped).sort((a, b) => a.day - b.day);

        autoDebitLoansList.innerHTML = '';

        if (!sortedGroups.length) {
            autoDebitLoansList.innerHTML = '<p style="color:#64748b;font-size:0.85em;">No active loans.</p>';
            return;
        }

        const today = new Date();
        const currentDay = today.getDate();

        sortedGroups.forEach(group => {
            const suffix = formatDateSuffix(group.day);
            const isDanger = group.loans.length >= 2;
            const isPast   = currentDay > group.day;
            const isToday  = currentDay === group.day;

            let statusClass = 'autodebit-future';
            let statusText  = `Due on ${group.day}${suffix}`;
            if (isToday)  { statusClass = 'autodebit-today';  statusText = `Due TODAY (${group.day}${suffix})`; }
            else if (isPast) { statusClass = 'autodebit-past'; statusText = `Paid — ${group.day}${suffix}`; }

            const card = document.createElement('div');
            card.className = `autodebit-card${isDanger ? ' autodebit-danger' : ''}`;

            const loanLines = group.loans.map(l => `
                <div class="autodebit-loan-row">
                    <span class="autodebit-bank">${l.bankName}</span>
                    <span class="autodebit-desc">${l.description}</span>
                    <span class="autodebit-emi">₹${l.emi.toLocaleString('en-IN')}</span>
                </div>`).join('');

            card.innerHTML = `
                <div class="autodebit-header">
                    <span class="autodebit-status ${statusClass}">${statusText}</span>
                    <span class="autodebit-total ${isDanger ? 'autodebit-total-danger' : ''}">
                        ${isDanger ? `<i class="fas fa-exclamation-triangle"></i> ` : ''}Total ₹${group.total.toLocaleString('en-IN')}
                    </span>
                </div>
                <div class="autodebit-loans">${loanLines}</div>`;

            autoDebitLoansList.appendChild(card);
        });
    }

    /**
     * Calculates and updates all loan-related metrics and populates `currentLoanData`.
     */
    function calculateAllLoanMetrics() {
        currentLoanData = []; // Reset global loan data
        totalInterestForAllLoans = 0; // Reset for recalculation
        totalPrincipalForAllLoans = 0; // Reset for recalculation

        const today = new Date();
        const currentDayOfMonth = today.getDate(); // Get current day of the month
        today.setHours(0, 0, 0, 0); // Normalize today to start of day for comparison

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

        if (!debtTableBody) {
            console.error("Debt table body not found.");
            return;
        }

        const debtRows = Array.from(debtTableBody.querySelectorAll('tr'));

        // Initialize yearly forecast for a range including past 3 years and future 5 years
        const startForecastYear = currentYear - 2;
        const endForecastYear = currentYear + 5;
        const yearlyForecast = {};
        for (let year = startForecastYear; year <= endForecastYear; year++) {
            yearlyForecast[year] = 0;
        }
        let totalEmiCurrentYearRemainingForecast = 0; // EMI from today until Dec 31 of current year

        debtRows.forEach(row => {
            const bankName = row.querySelector('td:nth-child(1)')?.textContent || 'N/A';
            const description = row.querySelector('td:nth-child(2)')?.textContent || 'Loan';
            const emi = parseFloat(row.dataset.emi) || 0;
            const endDay = parseInt(row.dataset.endDay) || 5;
            const endMonth = parseInt(row.dataset.endMonth) - 1; // 0-indexed
            const endYear = parseInt(row.dataset.endYear);
            const emiDay = parseInt(row.dataset.emiDay) || 5;
            const tenureMonths = parseInt(row.dataset.tenure) || 0;
            const startDay = parseInt(row.dataset.startDay) || 1;
            const startMonth = parseInt(row.dataset.startMonth) - 1; // 0-indexed
            const startYear = parseInt(row.dataset.startYear);
            const principalAmount = parseFloat(row.dataset.initialAmount) || 0;
            const annualInterestRate = parseFloat(row.dataset.interestRate) || 0;

            const loanStartDate = new Date(startYear, startMonth, startDay);
            const loanEndDate = new Date(endYear, endMonth, endDay, 23, 59, 59);

            // Set formatted end date in the table
            const endDateCell = row.querySelector('.end-date');
            if (endDateCell) {
                endDateCell.textContent = formatDate(endYear, endMonth + 1, endDay);
            }

            // Calculate months passed and remaining
            let monthsPassed = 0;
            if (today >= loanStartDate) {
                monthsPassed = (today.getFullYear() - loanStartDate.getFullYear()) * 12 + (today.getMonth() - loanStartDate.getMonth());
                // Adjust if current day is before EMI day in the current month, and it's not the loan start month
                if (currentDayOfMonth < emiDay && !(today.getFullYear() === loanStartDate.getFullYear() && today.getMonth() === loanStartDate.getMonth())) {
                    monthsPassed--;
                }
            }
            monthsPassed = Math.min(monthsPassed, tenureMonths); // Cap monthsPassed at total tenure

            let monthsRemaining = Math.max(0, tenureMonths - monthsPassed);
            let currentRemainingAmount = monthsRemaining * emi;

            // 🔒 Force completed loans based on actual end date
            if (today > loanEndDate) {
                monthsRemaining = 0;
                currentRemainingAmount = 0;
            }



            // Correct total payable (sum of all EMIs)
            const totalPayableForLoan = emi * tenureMonths;

            // Correct total interest
            const totalInterestForLoan = Math.max(0, totalPayableForLoan - principalAmount);


            totalInterestForAllLoans += totalInterestForLoan;
            totalPrincipalForAllLoans += principalAmount;

            // Update table cells for remaining amount and tenure
            const remainingAmountCell = row.querySelector('.remaining-amount');
            const remainingTenureCell = row.querySelector('.remaining-tenure');
            if (remainingAmountCell) {
                remainingAmountCell.textContent = `₹ ${currentRemainingAmount.toLocaleString('en-IN')}`;
            }
            if (remainingTenureCell) {
                remainingTenureCell.textContent = `${monthsRemaining}`;
            }

            // Calculate yearly forecast for this loan across the defined range
            for (let year = startForecastYear; year <= endForecastYear; year++) {
                let paymentsInYear = 0;
                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31, 23, 59, 59);

                for (let i = 0; i < tenureMonths; i++) {
                    const paymentDate = new Date(startYear, startMonth + i, 1);
                    paymentDate.setDate(emiDay);
                    paymentDate.setHours(0, 0, 0, 0);


                    // Check if payment date falls within the current forecast year AND within the loan's active period
                    if (paymentDate >= yearStart && paymentDate <= yearEnd && paymentDate >= loanStartDate && paymentDate <= loanEndDate) {
                        paymentsInYear++;
                    }
                }
                yearlyForecast[year] = (yearlyForecast[year] || 0) + (paymentsInYear * emi);
            }




            // Calculate current year's remaining forecast specifically (from today onwards)
            let paymentsInCurrentYearRemainingForLoan = 0;
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), currentDayOfMonth); // Use currentDayOfMonth
            const endOfCurrentYear = new Date(currentYear, 11, 31, 23, 59, 59);
            for (let i = 0; i < tenureMonths; i++) {

                const paymentDate = new Date(startYear, startMonth + i, 1);
                paymentDate.setDate(emiDay);
                paymentDate.setHours(0, 0, 0, 0);

                // Only count payments that are due from today's date onwards within the current year
                if (paymentDate >= startOfToday && paymentDate <= endOfCurrentYear && paymentDate >= loanStartDate && paymentDate <= loanEndDate) {
                    paymentsInCurrentYearRemainingForLoan++;
                }
            }
            totalEmiCurrentYearRemainingForecast += paymentsInCurrentYearRemainingForLoan * emi;

            // Calculate Next EMI Due Date for the loan box
            let nextEmiDateForBox = new Date(currentYear, currentMonth, emiDay);
            if (nextEmiDateForBox < today) { // If EMI day for current month has passed
                nextEmiDateForBox.setMonth(nextEmiDateForBox.getMonth() + 1);
            }
            // Ensure nextEmiDateForBox does not exceed loanEndDate
            if (monthsRemaining === 0) {
                nextEmiDateForBox = null;
            }
            const formattedNextEmiDate = nextEmiDateForBox
                ? formatDate(nextEmiDateForBox.getFullYear(), nextEmiDateForBox.getMonth() + 1, nextEmiDateForBox.getDate())
                : 'Completed';

            // Calculate Due Countdown Text
            let dueCountdownText = '';
            let dueCountdownClass = '';
            if (monthsRemaining <= 0) {
                dueCountdownText = 'Loan Completed!';
                dueCountdownClass = 'completed';
            } else if (currentDayOfMonth === emiDay) {
                dueCountdownText = 'Due Today!';
                dueCountdownClass = 'due-today';
            } else if (currentDayOfMonth < emiDay) {
                const daysLeft = emiDay - currentDayOfMonth;
                dueCountdownText = `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
                dueCountdownClass = 'due-future';
            } else { // currentDayOfMonth > emiDay
                // If EMI day has passed for the current month, it's considered paid for this month
                const daysPaidAgo = currentDayOfMonth - emiDay;
                dueCountdownText = `Paid ${daysPaidAgo} day${daysPaidAgo !== 1 ? 's' : ''} ago`;
                dueCountdownClass = 'paid'; // Changed from 'overdue' to 'paid'
            }

            currentLoanData.push({
                bankName,
                description,
                emi,
                monthsPassed, // <--- FIXED: Now correctly storing monthsPassed
                monthsRemaining,
                currentRemainingAmount,
                tenureMonths,
                progressPercentage: tenureMonths > 0 ? (monthsPassed / tenureMonths) * 100 : (monthsRemaining <= 0 ? 100 : 0),
                principalAmount: principalAmount,
                annualInterestRate: annualInterestRate,
                rowElement: row,
                nextEmiDate: formattedNextEmiDate,
                emiDay: emiDay, // Store emiDay for coloring logic
                loanEndDate: loanEndDate, // Store loanEndDate for completion check
                dueCountdown: dueCountdownText,
                dueCountdownClass: dueCountdownClass,
                startDateFormatted: formatDate(startYear, startMonth + 1, startDay),
                endDateFormatted: formatDate(endYear, endMonth + 1, endDay)
            });
        });



        return { yearlyForecast, totalEmiCurrentYearRemainingForecast };
    }

    /**
     * Updates the summary section with calculated totals.
     */
    function updateSummarySection() {
        let totalEmi = 0;
        let totalRemainingAmount = 0;
        let estimatedTotalInitialAmount = 0;
        let activeLoans = 0;
        let totalActiveEmiAmount = 0;
        let completedLoans = 0;
        const remainingByDescription = {};

        currentLoanData.forEach(loan => {
            // Total EMI (all loans – historical + active)
            totalEmi += loan.emi;

            // Active loans ONLY
            if (loan.monthsRemaining > 0 && loan.currentRemainingAmount > 0) {
                activeLoans++;
                totalActiveEmiAmount += loan.emi;
            } else {
                completedLoans++;
            }

            totalRemainingAmount += loan.currentRemainingAmount;
            estimatedTotalInitialAmount += (loan.emi * loan.tenureMonths); // Total original payable

            remainingByDescription[loan.description] =
                (remainingByDescription[loan.description] || 0) +
                loan.currentRemainingAmount;
        });

        const totalLoans = currentLoanData.length;

        if (totalLoansElement) {
            totalLoansElement.textContent = totalLoans;
        }

        if (completedLoansElement) {
            completedLoansElement.textContent = completedLoans;
        }

        if (totalActiveEmiElement) {
            totalActiveEmiElement.textContent =
                `₹ ${totalActiveEmiAmount.toLocaleString('en-IN')}`;
        }

        if (activeLoansElement) {
            activeLoansElement.textContent = activeLoans;
        }

        if (totalEmiElement) {
            totalEmiElement.textContent =
                `₹ ${totalEmi.toLocaleString('en-IN')}`;
        }

        if (totalRemainingElement) {
            totalRemainingElement.textContent =
                `₹ ${totalRemainingAmount.toLocaleString('en-IN')}`;
        }

        if (totalLoanAmountElement) {
            totalLoanAmountElement.textContent =
                `₹ ${estimatedTotalInitialAmount.toLocaleString('en-IN')}`;
        }



        if (totalInterestElement) {
            totalInterestElement.textContent =
                `₹ ${totalInterestForAllLoans.toLocaleString('en-IN')}`;
        }

        if (totalPrincipalElement) {
            totalPrincipalElement.textContent =
                `₹ ${totalPrincipalForAllLoans.toLocaleString('en-IN')}`;
        }

        if (summarySection) {
            summarySection
                .querySelectorAll('h3[data-description-summary]')
                .forEach(el => el.remove());

            const remainingAmountsArray = Object.entries(remainingByDescription);
            remainingAmountsArray.sort(
                ([, amountA], [, amountB]) => amountB - amountA
            );

            remainingAmountsArray.forEach(([description, remainingAmount]) => {

                //REMOVE LOAN TYPE IF REMAINING AMOUNT IS 0
                if (remainingAmount <= 0) return;

                const descriptionElement = document.createElement('h3');
                descriptionElement.setAttribute('data-description-summary', 'true');

                descriptionElement.innerHTML = `
                        ${description}: 
                        <span class="remaining-by-desc">
                            ₹ ${remainingAmount.toLocaleString('en-IN')}
                        </span>
                    `;

                summarySection.appendChild(descriptionElement);
            });

        }

        const freedomDate = getMaxEndDate();

        if (emiFreedomDateElement) {
            if (!freedomDate || freedomDate < new Date()) {
                emiFreedomDateElement.textContent = '🎉 EMI Free!';
            } else {
                emiFreedomDateElement.textContent =
                    freedomDate.toLocaleDateString('en-IN', {
                        month: 'short',
                        year: 'numeric'
                    });
            }
        }
    }


    /**
     * Updates the overall progress bar and estimated completion.
     * @param {number} estimatedTotalInitialAmount - The total initial loan amount.
     * @param {number} totalRemainingAmount - The total remaining loan amount.
     * @param {number} totalEmi - The total monthly EMI.
     */
    function updateOverallProgressSection(estimatedTotalInitialAmount, totalRemainingAmount, totalEmi) {
        if (overallProgressBar && overallProgressRaised && overallProgressTotal && estimatedTotalInitialAmount > 0) {
            const totalPaidAmount = estimatedTotalInitialAmount - totalRemainingAmount;
            const progressPercentage = Math.min(100, (totalPaidAmount / estimatedTotalInitialAmount) * 100);
            const roundedPercentage = parseFloat(progressPercentage.toFixed(2));

            overallProgressBar.style.width = `${roundedPercentage}%`;
            overallProgressPercentage.textContent = `${roundedPercentage}%`;
            overallProgressRaised.textContent = `₹ ${totalPaidAmount.toLocaleString('en-IN')} paid`;
            overallProgressTotal.textContent = `₹ ${estimatedTotalInitialAmount.toLocaleString('en-IN')} total`;
        } else if (overallProgressRaised && overallProgressTotal) {
            overallProgressRaised.textContent = '₹ 0 paid';
            overallProgressTotal.textContent = '₹ 0 total';
        }
    }

    /**
     * Renders/re-renders all individual loan boxes.
     */
    function renderLoanBoxes() {
        if (loanBoxesContainer) {
            loanBoxesContainer.innerHTML = '';
            currentLoanData.sort((a, b) => b.progressPercentage - a.progressPercentage);

            currentLoanData.forEach((loan, index) => {
                const loanBox = document.createElement('div');
                loanBox.classList.add('loan-box');
                loanBox.setAttribute('data-loan-id', index); // Use index for now, better to have a unique ID from data

                const totalPayable = loan.emi * loan.tenureMonths;
                const formattedTotalPayable = `₹ ${totalPayable.toLocaleString('en-IN', indianRupeeOptions)}`;

                const totalInterest = totalPayable - loan.principalAmount;
                const formattedTotalInterest = `₹ ${totalInterest.toLocaleString('en-IN', indianRupeeOptions)}`;

                const principalPercentage = (loan.principalAmount / totalPayable) * 100 || 0;
                const interestPercentage = (totalInterest / totalPayable) * 100 || 0;

                const logoUrl = bankLogos[loan.bankName] || 'https://placehold.co/80x40/cccccc/000000?text=Bank';

                // Add Foreclosure Button
                const forecloseButton = document.createElement('button');
                forecloseButton.classList.add('foreclose-button');

                // 🔒 If loan completed → disable button
                if (loan.monthsRemaining === 0) {
                    forecloseButton.textContent = 'Completed';
                    forecloseButton.disabled = true;
                    forecloseButton.classList.add('disabled-button');
                } else {
                    forecloseButton.textContent = 'Foreclose Calculator';

                    forecloseButton.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent main box click event
                        openForeclosureCalculator(loan);
                    });
                }


                loanBox.innerHTML = `
                    <div class="card-header">
                        <h3 class="bank-name">${loan.bankName}</h3>
                        <img src="${logoUrl}" alt="${loan.bankName} Logo" class="bank-logo">
                    </div>
                    <p>${loan.description}</p>
                    <p>EMI: ₹${loan.emi.toLocaleString('en-IN', indianRupeeOptions)}</p>
                    <p>Interest Rate: ${loan.annualInterestRate}%</p>

                    <p>Total (Principal + Interest): ${formattedTotalPayable}</p>

                    <div class="loan-breakdown-progress-container">
                        <div class="principal-progress" style="width: ${principalPercentage.toFixed(2)}%;">
                            <span class="progress-label principal-label"></span>
                            <span class="progress-value">${principalPercentage.toFixed(0)}%</span>
                        </div>
                        <div class="interest-progress" style="width: ${interestPercentage.toFixed(2)}%;">
                            <span class="progress-label interest-label"></span>
                            <span class="progress-value">${interestPercentage.toFixed(0)}%</span>
                        </div>
                    </div>

                    <div class="principal-interest-amounts">
                        <span class="principal-amount-display">Principal ₹ ${loan.principalAmount.toLocaleString('en-IN', indianRupeeOptions)}</span>
                        <span class="interest-amount-display">Interest  ${formattedTotalInterest}</span>
                    </div>
                    <p>Remaining Outstanding: ₹${loan.currentRemainingAmount.toLocaleString('en-IN', indianRupeeOptions)}</p>

                    <div class="loan-progress-bar-container">
                        <div class="loan-progress-bar" style="width: ${loan.progressPercentage}%;">
                            <span class="loan-progress-text-inside">${loan.progressPercentage.toFixed(2)}%</span>
                        </div>
                    </div>
                    <p class="remaining-tenure-display">${loan.monthsRemaining > 0 ? `${loan.monthsRemaining} months left (Total: ${loan.tenureMonths} months)` : 'Completed'}</p>
                    <p class="next-emi-date">Next EMI Due: <span>${loan.nextEmiDate}</span></p>
                    <p class="due-countdown ${loan.dueCountdownClass}">${loan.dueCountdown}</p>
                    `;

                // Append to loanBox
                loanBox.appendChild(forecloseButton);
                loanBoxesContainer.appendChild(loanBox);
            });
        }
    }

    /**
     * Updates the yearly EMI forecast section.
     * @param {object} yearlyForecast - Object containing yearly EMI totals.
     * @param {number} totalEmiCurrentYearRemainingForecast - Remaining EMI for current year.
     */
    function updateEmiForecastSection(yearlyForecast, totalEmiCurrentYearRemainingForecast) {
        const today = new Date();
        const currentYear = today.getFullYear();

        if (emiForecastSection) {
            emiForecastSection.innerHTML = '';

            const forecastTitle = document.createElement('h3');
            forecastTitle.textContent = 'Projected Yearly EMI Payments';
            emiForecastSection.appendChild(forecastTitle);

            for (const year in yearlyForecast) {
                const forecastElement = document.createElement('div');
                forecastElement.classList.add('yearly-forecast-item');

                const yearLabel = document.createElement('h3');
                let amountDisplay = '';
                let additionalInfo = '';

                if (parseInt(year) < currentYear) {
                    yearLabel.textContent = `${year} (Past)`;
                    amountDisplay = `₹ ${yearlyForecast[year].toLocaleString('en-IN')}`;
                    forecastElement.classList.add('past-year');
                } else if (parseInt(year) === currentYear) {
                    yearLabel.textContent = `${year} (Current)`;
                    amountDisplay = `₹ ${yearlyForecast[year].toLocaleString('en-IN')}`;
                    if (totalEmiCurrentYearRemainingForecast > 0) {
                        additionalInfo = `(Remaining: ₹ ${totalEmiCurrentYearRemainingForecast.toLocaleString('en-IN')})`;
                    }
                    forecastElement.classList.add('current-year');
                } else {
                    yearLabel.textContent = `${year} (Future)`;
                    amountDisplay = `₹ ${yearlyForecast[year].toLocaleString('en-IN')}`;
                    forecastElement.classList.add('future-year');
                }

                forecastElement.appendChild(yearLabel);

                const amountParagraph = document.createElement('p');
                amountParagraph.textContent = amountDisplay;
                if (additionalInfo) {
                    const infoSpan = document.createElement('span');
                    infoSpan.classList.add('additional-info');
                    infoSpan.textContent = additionalInfo;
                    amountParagraph.appendChild(infoSpan);
                }
                forecastElement.appendChild(amountParagraph);

                emiForecastSection.appendChild(forecastElement);
            }
        } else {
            console.log("EMI Forecast section not found in the HTML.");
        }
    }

    /**
     * Updates the Chart.js charts (Donut and Bar charts).
     */
    function updateCharts() {
        // Loan Breakdown Chart (Donut Chart)
        if (loanBreakdownChartCanvas) {
            const ctx = loanBreakdownChartCanvas.getContext('2d');
            // Destroy existing chart if it exists to prevent re-rendering issues
            if (window.loanBreakdownChartInstance) {
                window.loanBreakdownChartInstance.destroy();
            }
            window.loanBreakdownChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Principal', 'Interest'],
                    datasets: [{
                        data: [totalPrincipalForAllLoans, totalInterestForAllLoans],
                        backgroundColor: ["#3b82f6", "#ef4444"],
                        borderWidth: 0,
                        animation: {
                            animateRotate: true,
                            animateScale: true,
                            duration: 1000,
                            easing: 'easeInOutQuart'
                        }
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    const value = ctx.raw;
                                    return "₹ " + value.toLocaleString("en-IN");
                                }
                            }
                        }
                    }

                }
            });
        }

        // Loan Progress Over Time Chart (Bar Chart)
        if (loanChartCanvas && loanProgressChartContainer && currentLoanData.length > 0) {
            const ctx = loanChartCanvas.getContext('2d');
            // Destroy existing chart if it exists
            if (window.loanChartInstance) {
                window.loanChartInstance.destroy();
            }

            const monthlyTotals = {};
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth(); // 0-indexed
            const startMonthDate = new Date(currentYear, currentMonth, 1);
            const monthsToShow = 20;

            for (let i = 0; i < monthsToShow; i++) {
                const monthDate = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1);
                const label = monthDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                let paidThisMonth = 0;

                currentLoanData.forEach(loan => {
                    // Check if the loan is active during this month
                    const loanStartDate = new Date(parseInt(loan.rowElement.dataset.startYear), parseInt(loan.rowElement.dataset.startMonth) - 1, parseInt(loan.rowElement.dataset.startDay) || 1);
                    const loanEndDate = new Date(parseInt(loan.rowElement.dataset.endYear), parseInt(loan.rowElement.dataset.endMonth) - 1, parseInt(loan.rowElement.dataset.endDay) || 5);

                    // Calculate the specific EMI date for this month for the current loan
                    let emiDateThisMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), loan.emiDay);
                    // If the EMI day is past the month's last day (e.g., 31st in Feb), it will auto-adjust to the last day.

                    if (emiDateThisMonth >= loanStartDate && emiDateThisMonth <= loanEndDate) {
                        paidThisMonth += loan.emi;
                    }
                });
                monthlyTotals[label] = paidThisMonth;
            }

            window.loanChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(monthlyTotals),
                    datasets: [{
                        label: 'EMI Outflow (₹)',
                        data: Object.values(monthlyTotals),
                        backgroundColor: "#3b82f6",
                        hoverBackgroundColor: "#2563eb",
                        borderRadius: 8,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `₹ ${ctx.raw.toLocaleString('en-IN', indianRupeeOptions)}`
                            },
                            titleColor: '#e0e0e0', // Tooltip title color
                            bodyColor: '#e0e0e0',  // Tooltip body color
                            backgroundColor: "#3b82f6",
                            borderRadius: 6,
                            borderColor: '#00e0e0', // Cyan border
                            borderWidth: 1,
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: "#e5e7eb",
                                drawBorder: false
                            },
                            ticks: {
                                color: "#64748b"
                            }

                        },
                        x: {
                            ticks: {
                                color: "#64748b"
                            },
                            grid: {
                                display: false
                            }

                        }
                    },
                    title: {
                        display: true,
                        text: 'EMI Outflow for the Next 20 Months',
                        font: { size: 16, color: '#00e0e0' }, // Bright cyan title
                        align: 'center',
                        padding: { bottom: 10 }
                    }
                }
            });
        } else if (loanChartCanvas && loanProgressChartContainer) {
            loanProgressChartContainer.innerHTML = '<p style="color: #b0e0e6;">No active loans to display in the chart.</p>'; // Light text
            loanProgressChartContainer.style.background = 'linear-gradient(145deg, #1a2a3a 0%, #0f1c2c 100%)';
            loanProgressChartContainer.style.border = '1px solid rgba(0, 255, 255, 0.2)';
            loanProgressChartContainer.style.borderRadius = '8px';
            loanProgressChartContainer.style.padding = '25px';
            loanProgressChartContainer.style.textAlign = 'center';
            loanProgressChartContainer.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.4)';
        }
    }

    /**
     * Updates the top loans finishing soon list.
     */
    function updateTopLoansList() {
        // ✅ Filter only active loans
        const sortedLoans = [...currentLoanData]
            .filter(loan => loan.monthsRemaining > 0 && loan.currentRemainingAmount > 0)
            .sort((a, b) => a.monthsRemaining - b.monthsRemaining)
            .slice(0, topLoansCount);

        topLoansList.innerHTML = '';

        sortedLoans.forEach(loan => {
            const item = document.createElement('li');
            item.classList.add('top-loan-item');

            item.innerHTML = `
                <div class="top-loan-header">
                    <span class="top-loan-bank">${loan.bankName}</span>
                    <span class="top-loan-emi">
                        EMI: ₹<span>${loan.emi.toLocaleString('en-IN')}</span>
                    </span>
                </div>

                <div class="top-loan-details">
                    <span>
                        <span>${loan.monthsRemaining} months</span> Remaining /
                    </span>
                    <span class="top-loan-amount">
                        Outstanding: ₹<span>${loan.currentRemainingAmount.toLocaleString('en-IN')}</span>
                    </span>
                </div>

                <div class="top-loan-progress-container">
                    <div class="top-loan-progress-bar" style="width: ${loan.progressPercentage}%;">
                        <span class="top-loan-progress-text">
                            ${loan.progressPercentage.toFixed(1)}% Paid
                        </span>
                    </div>
                </div>
            `;

            topLoansList.appendChild(item);
        });
    }


    /**
     * Calculates and displays total debt per bank.
     */
    function updateDebtByBankSection() {
        const debtByBank = {};

        // Aggregate remaining amount by bankName
        currentLoanData.forEach(loan => {
            if (debtByBank[loan.bankName]) {
                debtByBank[loan.bankName] += loan.currentRemainingAmount;
            } else {
                debtByBank[loan.bankName] = loan.currentRemainingAmount;
            }
        });

        // Convert to array and sort by amount (descending)
        const sortedDebtByBank = Object.entries(debtByBank)
            .sort(([, amountA], [, amountB]) => amountB - amountA);

        if (debtByBankList) {
            const totalDebt = currentLoanData.reduce((s, l) => s + l.currentRemainingAmount, 0);
            debtByBankList.innerHTML = "";

            sortedDebtByBank.forEach(([bank, amount]) => {
                const percent = ((amount / totalDebt) * 100).toFixed(1);

                const row = document.createElement("div");
                row.className = "bank-debt-row";

                row.innerHTML = `
                    <img src="${bankLogos[bank] || 'bank.png'}" class="bank-debt-logo"/>
                    <div class="bank-debt-info">
                        <div class="bank-debt-name">${bank}</div>
                        <div class="bank-debt-bar">
                            <div class="bank-debt-fill" style="width:${percent}%"></div>
                        </div>
                    </div>
                    <div class="bank-debt-amount">₹ ${amount.toLocaleString("en-IN")}</div>
                `;

                debtByBankList.appendChild(row);
            });
        }

    }

    /**
     * Applies color classes to table rows based on EMI due date.
     */
    function updateTableLoanRowColors() {
        const today = new Date();
        const currentDayOfMonth = today.getDate();

        currentLoanData.forEach(loan => {
            const row = loan.rowElement;
            if (!row) return; // Skip if row element is no longer in DOM

            row.classList.remove('today-emi', 'future-emi', 'past-emi');

            // If loan is completed, ensure it's removed or marked as past
            if (loan.monthsRemaining <= 0) {
                row.remove(); // Remove from DOM if completed
                return;
            }

            const emiDay = loan.emiDay;

            if (currentDayOfMonth === emiDay) {
                row.classList.add('today-emi');
            } else if (currentDayOfMonth < emiDay) {
                row.classList.add('future-emi');
            } else { // currentDayOfMonth > emiDay
                row.classList.add('past-emi');
            }
        });
    }

    /**
     * Orchestrates all dashboard updates.
     */
    function updateDashboard() {
        const { yearlyForecast, totalEmiCurrentYearRemainingForecast } = calculateAllLoanMetrics();
        updateSummarySection();
        // Recalculate total EMI and remaining amount for overall progress
        let totalEmiForOverall = 0;

        let totalRemainingForOverall = 0;
        let estimatedTotalInitialAmountForOverall = 0;

        currentLoanData.forEach(loan => {
            totalEmiForOverall += loan.emi;
            totalRemainingForOverall += loan.currentRemainingAmount;
            estimatedTotalInitialAmountForOverall += (loan.emi * loan.tenureMonths);

        });
        updateOverallProgressSection(estimatedTotalInitialAmountForOverall, totalRemainingForOverall, totalEmiForOverall);
        renderLoanBoxes(); // This will re-render loan boxes with updated data and re-attach event listeners
        updateEmiForecastSection(yearlyForecast, totalEmiCurrentYearRemainingForecast);
        updateCharts();
        updateTopLoansList();
        updateDebtByBankSection(); // Call the new function to update debt by bank
        updateTableLoanRowColors(); // Update table row colors based on new remaining status
        updateOverallCountdown(); // Update countdown as well

    }

    // --- Table Sorting Logic ---
    function setupTableSorting() {
        let currentSortedColumn = null;
        let sortDirection = true; // true for ascending, false for descending

        document.querySelectorAll('.sortable').forEach(header => {
            header.dataset.originalText = header.textContent.trim();
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                const rows = Array.from(document.querySelectorAll('#bank-a-debts tr'));

                rows.sort((a, b) => {
                    const getValue = (row) => {
                        switch (column) {
                            case 'bank': return row.children[0].textContent.toLowerCase();
                            case 'description': return row.children[1].textContent.toLowerCase();
                            case 'end': return new Date(parseInt(row.dataset.endYear), parseInt(row.dataset.endMonth) - 1, parseInt(row.dataset.endDay) || 5);
                            case 'emi': return parseFloat(row.children[3].textContent.replace(/[^\d.-]/g, ''));
                            case 'remaining': return parseFloat(row.children[4].textContent.replace(/[^\d.-]/g, ''));
                            case 'tenure': return parseInt(row.children[5].textContent);
                            default: return '';
                        }
                    };

                    const aVal = getValue(a);
                    const bVal = getValue(b);

                    if (typeof aVal === 'string') {
                        return sortDirection ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    } else {
                        return sortDirection ? aVal - bVal : bVal - aVal;
                    }
                });

                if (currentSortedColumn === column) {
                    sortDirection = !sortDirection;
                } else {
                    sortDirection = true;
                    currentSortedColumn = column;
                }

                const tbody = document.getElementById('bank-a-debts');
                tbody.innerHTML = ''; // Clear the table body
                rows.forEach(row => tbody.appendChild(row));

                document.querySelectorAll('.sortable').forEach(h => {
                    h.textContent = h.dataset.originalText;
                });

                const arrow = sortDirection ? ' ↑' : ' ↓';
                header.textContent = header.dataset.originalText + arrow;
            });
        });
    }

    // --- Initialization on DOMContentLoaded ---
    populateCreditCards();
    populateCreditCardTable();
    // Initial call to populate all sections

    // Overall Loan End Date Countdown Timer setup
    const overallCountdownContainer = document.createElement('div');
    overallCountdownContainer.classList.add('countdown-timer');
    overallCountdownContainer.style.fontSize = '16px';
    overallCountdownContainer.style.fontWeight = '500';
    overallCountdownContainer.style.marginTop = '10px';

    setInterval(updateOverallCountdown, 1000);
    updateOverallCountdown(); // Initial call to display immediately

    if (overallProgressSection) {
        overallProgressSection.appendChild(overallCountdownContainer);
    }

    setupTableSorting();


    // ============= LOAN DATABASE MANAGEMENT SYSTEM =============
    let loansDatabase = [];

    // Initialize database from localStorage or load hardcoded data
    function initializeDatabase() {
        const savedLoans = localStorage.getItem('loansDatabase');
        if (savedLoans) {
            loansDatabase = JSON.parse(savedLoans);
            renderLoansFromDatabase();
        } else {
            loadHardcodedLoans();
        }
    }

    // Default Loan Data (Migrated from HTML)
    const DEFAULT_LOANS = [
        {
            bankName: "IDFC BANK",
            description: "Credit card loan",
            initialAmount: 10000,
            emi: 1186,
            interestRate: 16,
            tenure: 9,
            startDay: 19,
            startMonth: 12,
            startYear: 2024,
            emiDay: 19,
            endDay: 19,
            endMonth: 9,
            endYear: 2025
        },
        {
            bankName: "SBI BANK",
            description: "Flexipay",
            initialAmount: 40911,
            emi: 2017,
            interestRate: 16.8,
            tenure: 24,
            startDay: 11,
            startMonth: 10,
            startYear: 2023,
            emiDay: 11,
            endDay: 11,
            endMonth: 9,
            endYear: 2025
        },
        {
            bankName: "SBI BANK",
            description: "Laptop",
            initialAmount: 52451,
            emi: 3284,
            interestRate: 16,
            tenure: 18,
            startDay: 11,
            startMonth: 8,
            startYear: 2024,
            emiDay: 11,
            endDay: 11,
            endMonth: 2,
            endYear: 2026
        },
        {
            bankName: "ICICI BANK",
            description: "Credit card loan",
            initialAmount: 35000,
            emi: 1713,
            interestRate: 16,
            tenure: 24,
            startDay: 28,
            startMonth: 2,
            startYear: 2024,
            emiDay: 28,
            endDay: 28,
            endMonth: 2,
            endYear: 2026
        },
        {
            bankName: "KOTAK BANK",
            description: "Personal loan",
            initialAmount: 60000,
            emi: 3915,
            interestRate: 21,
            tenure: 18,
            startDay: 2,
            startMonth: 10,
            startYear: 2024,
            emiDay: 2,
            endDay: 2,
            endMonth: 4,
            endYear: 2026
        },
        {
            bankName: "DMI FINANCE",
            description: "Personal loan",
            initialAmount: 300000,
            emi: 11457,
            interestRate: 21,
            tenure: 36,
            startDay: 5,
            startMonth: 5,
            startYear: 2023,
            emiDay: 5,
            endDay: 5,
            endMonth: 5,
            endYear: 2026
        },
        {
            bankName: "ICICI BANK",
            description: "Credit card loan",
            initialAmount: 35000,
            emi: 1713,
            interestRate: 16,
            tenure: 24,
            startDay: 28,
            startMonth: 5,
            startYear: 2024,
            emiDay: 28,
            endDay: 28,
            endMonth: 5,
            endYear: 2026
        },
        {
            bankName: "SBI BANK",
            description: "Encash",
            initialAmount: 200000,
            emi: 7031,
            interestRate: 16,
            tenure: 36,
            startDay: 11,
            startMonth: 6,
            startYear: 2023,
            emiDay: 11,
            endDay: 11,
            endMonth: 6,
            endYear: 2026
        },
        {
            bankName: "AXIS BANK",
            description: "Credit card loan",
            initialAmount: 30000,
            emi: 1953,
            interestRate: 18,
            tenure: 18,
            startDay: 13,
            startMonth: 12,
            startYear: 2024,
            emiDay: 13,
            endDay: 13,
            endMonth: 6,
            endYear: 2026
        },
        {
            bankName: "IDFC BANK",
            description: "Two wheeler loan",
            initialAmount: 42821,
            emi: 3885,
            interestRate: 16,
            tenure: 12,
            startDay: 24,
            startMonth: 6,
            startYear: 2025,
            emiDay: 24,
            endDay: 24,
            endMonth: 6,
            endYear: 2026
        },
        {
            bankName: "SBI BANK",
            description: "Flexipay",
            initialAmount: 43010,
            emi: 1533,
            interestRate: 17.02,
            tenure: 36,
            startDay: 11,
            startMonth: 7,
            startYear: 2023,
            emiDay: 11,
            endDay: 11,
            endMonth: 7,
            endYear: 2026
        },
        {
            bankName: "RBL BANK",
            description: "Personal loan",
            initialAmount: 174000,
            emi: 8941,
            interestRate: 21,
            tenure: 24,
            startDay: 12,
            startMonth: 8,
            startYear: 2024,
            emiDay: 12,
            endDay: 12,
            endMonth: 8,
            endYear: 2026
        },
        {
            bankName: "KOTAK BANK",
            description: "Kjc fees",
            initialAmount: 33584,
            emi: 1692,
            interestRate: 19,
            tenure: 24,
            startDay: 25,
            startMonth: 8,
            startYear: 2024,
            emiDay: 25,
            endDay: 25,
            endMonth: 8,
            endYear: 2026
        },
        {
            bankName: "SBI BANK",
            description: "Fridge",
            initialAmount: 18530,
            emi: 1677,
            interestRate: 15.5,
            tenure: 12,
            startDay: 11,
            startMonth: 9,
            startYear: 2025,
            emiDay: 11,
            endDay: 11,
            endMonth: 9,
            endYear: 2026
        },
        {
            bankName: "KOTAK BANK",
            description: "Kjc fees",
            initialAmount: 83451,
            emi: 3058,
            interestRate: 19,
            tenure: 36,
            startDay: 25,
            startMonth: 1,
            startYear: 2024,
            emiDay: 25,
            endDay: 25,
            endMonth: 2,
            endYear: 2027
        },
        {
            bankName: "SBI BANK",
            description: "Jimcy",
            initialAmount: 40000,
            emi: 3203,
            interestRate: 16,
            tenure: 18,
            startDay: 26,
            startMonth: 11,
            startYear: 2025,
            emiDay: 26,
            endDay: 26,
            endMonth: 4,
            endYear: 2027
        },
        {
            bankName: "IDFC BANK",
            description: "Jimcy",
            initialAmount: 40000,
            emi: 2155,
            interestRate: 16,
            tenure: 24,
            startDay: 24,
            startMonth: 7,
            startYear: 2025,
            emiDay: 23,
            endDay: 23,
            endMonth: 6,
            endYear: 2027
        },
        {
            bankName: "CREDIT SAISON",
            description: "Personal loan",
            initialAmount: 250000,
            emi: 9037,
            interestRate: 18,
            tenure: 36,
            startDay: 19,
            startMonth: 8,
            startYear: 2025,
            emiDay: 3,
            endDay: 3,
            endMonth: 7,
            endYear: 2028
        },
        {
            bankName: "INDUSIND BANK",
            description: "Credit card loan",
            initialAmount: 40000,
            emi: 1406,
            interestRate: 16,
            tenure: 36,
            startDay: 15,
            startMonth: 7,
            startYear: 2025,
            emiDay: 15,
            endDay: 15,
            endMonth: 7,
            endYear: 2028
        },
        {
            bankName: "INDUSIND BANK",
            description: "Personal loan",
            initialAmount: 200000,
            emi: 5823,
            interestRate: 17.5,
            tenure: 48,
            startDay: 4,
            startMonth: 1,
            startYear: 2025,
            emiDay: 4,
            endDay: 4,
            endMonth: 2,
            endYear: 2029
        },
        {
            bankName: "AXIS BANK",
            description: "Personal loan",
            initialAmount: 196000,
            emi: 4560,
            interestRate: 14,
            tenure: 60,
            startDay: 5,
            startMonth: 3,
            startYear: 2025,
            emiDay: 5,
            endDay: 5,
            endMonth: 2,
            endYear: 2030
        }
    ];

    // Load hardcoded loans from JS constant
    function loadHardcodedLoans() {
        loansDatabase = [];

        DEFAULT_LOANS.forEach(loan => {
            loansDatabase.push({
                ...loan,
                id: Date.now() + Math.random()
            });
        });

        saveToLocalStorage();
    }

    // Save to localStorage
    function saveToLocalStorage() {
        localStorage.setItem('loansDatabase', JSON.stringify(loansDatabase));
    }

    // Render loans from database to HTML table
    function renderLoansFromDatabase() {
        const tbody = document.getElementById('bank-a-debts');
        tbody.innerHTML = '';

        loansDatabase.forEach(loan => {
            const row = document.createElement('tr');
            row.dataset.initialAmount = loan.initialAmount;
            row.dataset.emi = loan.emi;
            row.dataset.endDay = loan.endDay;
            row.dataset.emiDay = loan.emiDay;
            row.dataset.endMonth = loan.endMonth;
            row.dataset.endYear = loan.endYear;
            row.dataset.tenure = loan.tenure;
            row.dataset.startMonth = loan.startMonth;
            row.dataset.startYear = loan.startYear;
            row.dataset.startDay = loan.startDay;
            row.dataset.interestRate = loan.interestRate;
            row.dataset.description = loan.description;


            row.innerHTML = `
                <td>${loan.bankName}</td>
                <td>${loan.description}</td>
                <td class="end-date"></td>
                <td>₹ ${loan.emi.toLocaleString('en-IN')}</td>
                <td class="remaining-amount"></td>
                <td class="remaining-tenure"></td>
            `;

            tbody.appendChild(row);
        });


    }

    // Admin Panel Functions
    window.openAdminPanel = function () {
        const modal = document.getElementById('adminModal');
        if (modal) {
            modal.style.display = 'block';
            refreshAdminLoansList();
        }
    };

    window.closeAdminPanel = function () {
        const modal = document.getElementById('adminModal');
        if (modal) {
            modal.style.display = 'none';
            resetForm();
        }
    };

    window.resetForm = function () {
        document.getElementById('loanForm').reset();
        document.getElementById('loanId').value = '';
        document.getElementById('editMode').value = 'false';
    };

    function refreshAdminLoansList() {
        const tbody = document.getElementById('adminLoansTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        loansDatabase.forEach((loan, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${loan.bankName}</td>
                <td>${loan.description}</td>
                <td>₹ ${loan.initialAmount.toLocaleString('en-IN')}</td>
                <td>₹ ${loan.emi.toLocaleString('en-IN')}</td>
                <td>
                    <button onclick="editLoan(${index})" class="btn-edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteLoan(${index})" class="btn-delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Handle loan form submission
    const loanForm = document.getElementById('loanForm');
    if (loanForm) {
        loanForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Clear previous validation errors
            loanForm.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
            loanForm.querySelectorAll('.field-error').forEach(el => el.remove());

            let hasError = false;
            const requiredFields = ['bankName', 'description', 'initialAmount', 'emi', 'interestRate', 'tenure', 'startDay', 'startMonth', 'startYear', 'emiDay'];

            requiredFields.forEach(id => {
                const input = document.getElementById(id);
                if (!input || input.value.trim() === '') {
                    if (input) {
                        input.classList.add('invalid');
                        const err = document.createElement('span');
                        err.className = 'field-error';
                        err.textContent = 'Required';
                        input.parentNode.appendChild(err);
                    }
                    hasError = true;
                }
            });

            const initialAmt = parseFloat(document.getElementById('initialAmount').value);
            const emiAmt = parseFloat(document.getElementById('emi').value);
            const rate = parseFloat(document.getElementById('interestRate').value);
            const tenure = parseInt(document.getElementById('tenure').value);

            if (!hasError && emiAmt * tenure < initialAmt) {
                showToast('Warning: Total EMI payments are less than the initial amount. Please check the values.', 'warning', 5000);
            }

            if (hasError) {
                showToast('Please fill in all required fields.', 'error');
                return;
            }

            const loanData = {
                id: document.getElementById('loanId').value || Date.now() + Math.random(),
                bankName: document.getElementById('bankName').value,
                description: document.getElementById('description').value,
                initialAmount: parseFloat(document.getElementById('initialAmount').value),
                emi: parseFloat(document.getElementById('emi').value),
                interestRate: parseFloat(document.getElementById('interestRate').value),
                tenure: parseInt(document.getElementById('tenure').value),
                startDay: parseInt(document.getElementById('startDay').value),
                startMonth: parseInt(document.getElementById('startMonth').value),
                startYear: parseInt(document.getElementById('startYear').value),
                emiDay: parseInt(document.getElementById('emiDay').value),
                endDay: parseInt(document.getElementById('emiDay').value),
                endMonth: (parseInt(document.getElementById('startMonth').value) + parseInt(document.getElementById('tenure').value) - 1) % 12 || 12,
                endYear: parseInt(document.getElementById('startYear').value) + Math.floor((parseInt(document.getElementById('startMonth').value) + parseInt(document.getElementById('tenure').value) - 1) / 12)
            };

            const editMode = document.getElementById('editMode').value === 'true';

            if (editMode) {
                const index = loansDatabase.findIndex(l => l.id == loanData.id);
                if (index !== -1) {
                    loansDatabase[index] = loanData;
                }
            } else {
                loansDatabase.push(loanData);
            }

            saveToLocalStorage();
            renderLoansFromDatabase();
            refreshAdminLoansList();
            updateDashboard();
            runNewFeatures();
            resetForm();

            showToast(editMode ? 'Loan updated successfully!' : 'Loan added successfully!', 'success');
        });
    }

    // Edit loan function
    window.editLoan = function (index) {
        const loan = loansDatabase[index];

        document.getElementById('loanId').value = loan.id;
        document.getElementById('bankName').value = loan.bankName;
        document.getElementById('description').value = loan.description;
        document.getElementById('initialAmount').value = loan.initialAmount;
        document.getElementById('emi').value = loan.emi;
        document.getElementById('interestRate').value = loan.interestRate;
        document.getElementById('tenure').value = loan.tenure;
        document.getElementById('startDay').value = loan.startDay;
        document.getElementById('startMonth').value = loan.startMonth;
        document.getElementById('startYear').value = loan.startYear;
        document.getElementById('emiDay').value = loan.emiDay;

        document.getElementById('editMode').value = 'true';
    };

    // Delete loan function
    window.deleteLoan = function (index) {
        showConfirm('Are you sure you want to delete this loan? This cannot be undone.', () => {
            loansDatabase.splice(index, 1);
            saveToLocalStorage();
            renderLoansFromDatabase();
            refreshAdminLoansList();
            updateDashboard();
            runNewFeatures();
            showToast('Loan deleted.', 'warning');
        });
    };

    // Export loans to JSON file
    window.exportLoans = function () {
        const dataStr = JSON.stringify(loansDatabase, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

        const exportFileDefaultName = `loans_backup_${new Date().toISOString().slice(0, 10)}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    // Import loans from JSON file
    window.importLoans = function () {
        document.getElementById('importFile').click();
    };

    // Handle file import
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const importedLoans = JSON.parse(e.target.result);
                    if (Array.isArray(importedLoans)) {
                        loansDatabase = importedLoans;
                        saveToLocalStorage();
                        renderLoansFromDatabase();
                        refreshAdminLoansList();
                        showToast('Loans imported successfully!', 'success');
                    } else {
                        showToast('Invalid file format — expected a JSON array.', 'error');
                    }
                } catch (error) {
                    showToast('Error importing file: ' + error.message, 'error');
                }
            };
            reader.readAsText(file);
        });
    }

    // Admin panel event listeners
    const adminBtn = document.getElementById('adminToggleBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', openAdminPanel);
    }

    // Use querySelectorAll and wire each .close-admin to its own modal
    document.querySelectorAll('.close-admin').forEach(btn => {
        btn.addEventListener('click', function () {
            const modal = this.closest('.modal');
            if (modal) modal.style.display = 'none';
            if (modal && modal.id === 'adminModal') resetForm();
        });
    });

    window.addEventListener('click', function (event) {
        const modal = document.getElementById('adminModal');
        if (event.target === modal) {
            closeAdminPanel();
        }
    });

    // ================================================================
    // FEATURE 1: INTEREST RATE COMPARISON
    // ================================================================
    function renderInterestRateComparison() {
        const container = document.getElementById('interest-rate-list');
        const tipEl = document.getElementById('attack-order-tip');
        if (!container) return;

        // Only active loans
        const activeLoans = currentLoanData.filter(l => l.monthsRemaining > 0);
        if (!activeLoans.length) { container.innerHTML = '<p style="color:#64748b;font-size:0.85em;">No active loans.</p>'; return; }

        // Pre-compute interestPct for each loan so we can sort by it
        const loansWithPct = activeLoans.map(loan => {
            const totalPayable = loan.emi * loan.tenureMonths;
            const totalInterest = Math.max(0, totalPayable - loan.principalAmount);
            const interestPct = totalPayable > 0 ? (totalInterest / totalPayable) * 100 : 0;
            const principalPct = 100 - interestPct;
            return { loan, totalPayable, totalInterest, interestPct, principalPct };
        });

        // Sort by actual interest cost % descending
        loansWithPct.sort((a, b) => b.interestPct - a.interestPct);
        const maxInterestPct = loansWithPct[0].interestPct;

        container.innerHTML = '';
        loansWithPct.forEach(({ loan, totalPayable, totalInterest, interestPct, principalPct }, i) => {
            const rate = loan.annualInterestRate;
            // Bar width relative to highest interest cost loan
            const barPct = maxInterestPct > 0 ? (interestPct / maxInterestPct) * 100 : 0;
            let colorClass = 'rate-low';
            if (interestPct >= 20) colorClass = 'rate-high';
            else if (interestPct >= 12) colorClass = 'rate-medium';

            const row = document.createElement('div');
            row.className = 'rate-row';
            row.innerHTML = `
                <div class="rate-row-header">
                    <span class="rate-rank">#${i + 1}</span>
                    <span class="rate-bank">${loan.bankName}</span>
                    <span class="rate-desc">${loan.description}</span>
                    <span class="rate-badge ${colorClass}">${interestPct.toFixed(1)}% <span class="rate-annual">(${rate}% p.a.)</span></span>
                </div>
                <div class="rate-meta">
                    <span>EMI ₹${loan.emi.toLocaleString('en-IN')} · ${loan.monthsRemaining}m left</span>
                    <span>Outstanding ₹${loan.currentRemainingAmount.toLocaleString('en-IN')}</span>
                </div>`;
            container.appendChild(row);
        });

        // Attack order tip
        if (tipEl && loansWithPct.length >= 1) {
            const { loan: top, interestPct: topPct } = loansWithPct[0];
            tipEl.style.display = 'block';
            tipEl.innerHTML = `<i class="fas fa-crosshairs"></i> <strong>Attack first:</strong> ${top.bankName} ${top.description} — <strong>${topPct.toFixed(1)}%</strong> of total payments is pure interest.`;
        }
    }

    // ================================================================
    // FEATURE 2: EMI REMINDERS (Web Notifications API)
    // ================================================================
    function getReminderDays() {
        return parseInt(localStorage.getItem('reminderDays') || '3');
    }

    function getReminderTime() {
        return localStorage.getItem('reminderTime') || '09:00';
    }

    function getUpcomingEmiReminders(daysAhead) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = [];
        currentLoanData.forEach(loan => {
            if (loan.monthsRemaining <= 0) return;
            const emiDay = loan.emiDay;
            const thisMonth = new Date(today.getFullYear(), today.getMonth(), emiDay);
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, emiDay);
            [thisMonth, nextMonth].forEach(dueDate => {
                const diff = Math.ceil((dueDate - today) / 86400000);
                if (diff >= 0 && diff <= daysAhead) {
                    upcoming.push({ loan, dueDate, daysLeft: diff });
                }
            });
        });
        return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
    }

    function updateReminderBadge() {
        const badge = document.getElementById('reminderBadge');
        if (!badge) return;
        const days = getReminderDays();
        const upcoming = getUpcomingEmiReminders(days);
        const total = upcoming.length;
        if (total > 0) {
            badge.textContent = total;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    function getBankIcon(bankName) {
        if (!bankName) return 'images/favicon.png';
        const upper = bankName.toUpperCase();
        // Exact match first
        if (bankLogos[upper]) return bankLogos[upper];
        // Fuzzy match — find first key that appears in the bank name or vice versa
        const match = Object.keys(bankLogos).find(k => upper.includes(k) || k.includes(upper));
        return match ? bankLogos[match] : 'images/favicon.png';
    }

    function fireNotificationsIfDue() {
        if (Notification.permission !== 'granted') return;
        const days = getReminderDays();
        const upcoming = getUpcomingEmiReminders(days);
        const fired = JSON.parse(localStorage.getItem('firedNotifs') || '{}');
        const todayKey = new Date().toISOString().slice(0, 10);
        if (!fired[todayKey]) fired[todayKey] = [];

        const [rh, rm] = getReminderTime().split(':').map(Number);
        const now = new Date();
        // Only fire if current time is at or past the scheduled reminder time
        const scheduledToday = new Date();
        scheduledToday.setHours(rh, rm, 0, 0);
        if (now < scheduledToday) {
            // Schedule them for later today
            upcoming.forEach(({ loan, daysLeft }) => {
                const key = `${loan.bankName}-${loan.description}-${daysLeft}`;
                if (!fired[todayKey].includes(key)) {
                    const emiAmt = `₹${loan.emi.toLocaleString('en-IN')}`;
                    const loanLabel = `${loan.bankName} ${loan.description}`;
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + daysLeft);
                    const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    let title, body;
                    if (daysLeft === 0) {
                        title = `⚠️ EMI Alert: ${emiAmt} for ${loanLabel}`;
                        body = `Your EMI is due TODAY! Don't miss your payment.`;
                    } else if (daysLeft === 1) {
                        title = `⚠️ EMI Alert: ${emiAmt} for ${loanLabel}`;
                        body = `is due tomorrow.`;
                    } else {
                        title = `🔔 EMI Reminder: ${emiAmt} for ${loanLabel}`;
                        body = `is due in ${daysLeft} days (${dueDateStr}).`;
                    }
                    const bankIcon = getBankIcon(loan.bankName);
                    const delay = scheduledToday - now;
                    setTimeout(() => {
                        if (Notification.permission === 'granted') {
                            new Notification(title, { body, icon: bankIcon });
                        }
                    }, delay);
                    fired[todayKey].push(key);
                }
            });
        } else {
            upcoming.forEach(({ loan, daysLeft }) => {
                const key = `${loan.bankName}-${loan.description}-${daysLeft}`;
                if (!fired[todayKey].includes(key)) {
                    const emiAmt = `₹${loan.emi.toLocaleString('en-IN')}`;
                    const loanLabel = `${loan.bankName} ${loan.description}`;
                    const dueDate = new Date();
                    dueDate.setDate(dueDate.getDate() + daysLeft);
                    const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                    let title, body;
                    if (daysLeft === 0) {
                        title = `⚠️ EMI Alert: ${emiAmt} for ${loanLabel}`;
                        body = `Your EMI is due TODAY! Don't miss your payment.`;
                    } else if (daysLeft === 1) {
                        title = `⚠️ EMI Alert: ${emiAmt} for ${loanLabel}`;
                        body = `is due tomorrow.`;
                    } else {
                        title = `🔔 EMI Reminder: ${emiAmt} for ${loanLabel}`;
                        body = `is due in ${daysLeft} days (${dueDateStr}).`;
                    }
                    new Notification(title, {
                        body,
                        icon: getBankIcon(loan.bankName)
                    });
                    fired[todayKey].push(key);
                }
            });
        }
        Object.keys(fired).forEach(k => { if (k < todayKey) delete fired[k]; });
        localStorage.setItem('firedNotifs', JSON.stringify(fired));
    }

    function renderReminderModal() {
        const statusEl = document.getElementById('notifPermStatus');
        const slider = document.getElementById('reminderDaysSlider');
        const timeInput = document.getElementById('reminderTime');

        const perm = Notification.permission;
        if (statusEl) {
            if (perm === 'granted') {
                statusEl.innerHTML = '✅ Enabled';
                statusEl.style.color = '#d1fae5';
            } else if (perm === 'denied') {
                statusEl.innerHTML = '❌ Blocked';
                statusEl.style.color = '#fecaca';
            } else {
                statusEl.innerHTML = '⚠️ Not set';
                statusEl.style.color = '#fde68a';
            }
        }

        const days = getReminderDays();
        if (slider) slider.value = days;
        const label = document.getElementById('reminderDaysLabel');
        if (label) label.textContent = days;
        if (timeInput) timeInput.value = getReminderTime();

        // Upcoming tab
        const listEl = document.getElementById('upcoming-reminders-list');
        if (!listEl) return;
        const upcoming = getUpcomingEmiReminders(days);
        if (!upcoming.length) {
            listEl.innerHTML = `<p class="rmd-empty" style="padding:20px 0;">No EMIs due within the next ${days} day${days > 1 ? 's' : ''}.</p>`;
            return;
        }
        listEl.innerHTML = `<p style="font-size:0.78em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;">Within next ${days} day${days > 1 ? 's' : ''}</p>`;
        upcoming.forEach(({ loan, daysLeft }) => {
            const urgencyClass = daysLeft === 0 ? 'reminder-today' : daysLeft <= 2 ? 'reminder-soon' : 'reminder-upcoming';
            const urgencyText = daysLeft === 0 ? 'TODAY' : `in ${daysLeft}d`;
            const item = document.createElement('div');
            item.className = `reminder-item ${urgencyClass}`;
            item.innerHTML = `
                <div class="reminder-item-left">
                    <span class="reminder-urgency">${urgencyText}</span>
                    <span class="reminder-bank">${loan.bankName}</span>
                    <span class="reminder-desc">${loan.description}</span>
                </div>
                <span class="reminder-amt">₹${loan.emi.toLocaleString('en-IN')}</span>`;
            listEl.appendChild(item);
        });
    }

    // Reminder modal wiring
    const bellBtn = document.getElementById('reminderBellBtn');
    const reminderModal = document.getElementById('reminderModal');
    const closeReminderBtn = document.getElementById('closeReminderModal');
    const reqPermBtn = document.getElementById('requestNotifPermBtn');
    const daysSlider = document.getElementById('reminderDaysSlider');
    const daysLabel = document.getElementById('reminderDaysLabel');
    const timeInput = document.getElementById('reminderTime');

    if (bellBtn && reminderModal) {
        bellBtn.addEventListener('click', () => {
            renderReminderModal();
            reminderModal.style.display = 'block';
        });
    }
    if (closeReminderBtn && reminderModal) {
        closeReminderBtn.addEventListener('click', () => { reminderModal.style.display = 'none'; });
    }
    window.addEventListener('click', e => { if (e.target === reminderModal) reminderModal.style.display = 'none'; });

    // Tab switching
    document.querySelectorAll('.rmd-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.rmd-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.rmd-tab-panel').forEach(p => p.style.display = 'none');
            tab.classList.add('active');
            const target = document.getElementById('rmdTab-' + tab.dataset.tab);
            if (target) target.style.display = 'block';
            if (tab.dataset.tab === 'upcoming') renderReminderModal();
        });
    });

    if (reqPermBtn) {
        reqPermBtn.addEventListener('click', () => {
            if (!('Notification' in window)) { showToast('Your browser does not support notifications.', 'error'); return; }
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                    showToast('Notifications enabled! You\'ll be reminded before each EMI.', 'success');
                    fireNotificationsIfDue();
                } else {
                    showToast('Notification permission denied.', 'error');
                }
                renderReminderModal();
                updateReminderBadge();
            });
        });
    }

    if (daysSlider && daysLabel) {
        daysSlider.addEventListener('input', () => {
            daysLabel.textContent = daysSlider.value;
            localStorage.setItem('reminderDays', daysSlider.value);
            updateReminderBadge();
        });
    }

    if (timeInput) {
        timeInput.addEventListener('change', () => {
            localStorage.setItem('reminderTime', timeInput.value);
            showToast(`Daily reminder time set to ${timeInput.value}`, 'success');
        });
    }

    // ================================================================
    // FEATURE 3: CREDIT CARD EMI TRACKER
    // ================================================================
    function renderCCEmiTracker() {
        const grid = document.getElementById('cc-emi-tracker-grid');
        if (!grid) return;

        // CC EMI loans = loans where description includes "credit card" (case-insensitive)
        const ccEmiLoans = currentLoanData.filter(l =>
            l.description.toLowerCase().includes('credit card') && l.monthsRemaining > 0
        );

        // Also match by bank name to the credit card list
        const ccBankMap = {};
        creditCardData1.forEach(c => {
            const bankKey = c.name.toUpperCase();
            ccBankMap[bankKey] = c;
        });

        grid.innerHTML = '';
        if (!ccEmiLoans.length) {
            grid.innerHTML = '<p style="color:#64748b;font-size:0.85em;padding:12px 0;">No active credit card EMI conversions detected.</p>';
            return;
        }

        ccEmiLoans.forEach(loan => {
            // Try to match this EMI loan to a credit card
            let matchedCard = null;
            for (const [key, card] of Object.entries(ccBankMap)) {
                if (key.includes(loan.bankName.replace(' BANK','').replace(' FINANCE','')) ||
                    loan.bankName.includes(key.split(' ')[0])) {
                    matchedCard = card;
                    break;
                }
            }

            const totalOutstanding = matchedCard ? matchedCard.currentOutstanding : null;
            const emiOutstanding = loan.currentRemainingAmount;
            const rawOutstanding = totalOutstanding !== null ? Math.max(0, totalOutstanding - emiOutstanding) : null;

            const card = document.createElement('div');
            card.className = 'cc-emi-card';
            card.innerHTML = `
                <div class="cc-emi-card-header">
                    <span class="cc-emi-bank">${loan.bankName}</span>
                    <span class="cc-emi-badge">EMI Conversion</span>
                </div>
                <div class="cc-emi-desc">${loan.description}</div>
                <div class="cc-emi-rows">
                    <div class="cc-emi-row"><span>Monthly EMI</span><strong>₹${loan.emi.toLocaleString('en-IN')}</strong></div>
                    <div class="cc-emi-row"><span>EMI Outstanding</span><strong class="emi-amt">₹${emiOutstanding.toLocaleString('en-IN')}</strong></div>
                    ${rawOutstanding !== null ? `<div class="cc-emi-row"><span>Raw CC Outstanding</span><strong class="raw-amt">₹${rawOutstanding.toLocaleString('en-IN')}</strong></div>` : ''}
                    <div class="cc-emi-row"><span>Months Remaining</span><strong>${loan.monthsRemaining}</strong></div>
                    <div class="cc-emi-row"><span>Interest Rate</span><strong>${loan.annualInterestRate}%</strong></div>
                    <div class="cc-emi-row"><span>Next EMI Due</span><strong>${loan.nextEmiDate}</strong></div>
                </div>
                <div class="cc-emi-status ${loan.dueCountdownClass}">${loan.dueCountdown}</div>`;
            grid.appendChild(card);
        });
    }

    // ================================================================
    // FEATURE 4: MONTHLY CASH FLOW PLANNER
    // ================================================================
    let cashflowDate = new Date();
    cashflowDate.setDate(1);

    function positionCalTip(e, tipBox) {
        const margin = 12;
        const tw = tipBox.offsetWidth || 220;
        const th = tipBox.offsetHeight || 100;
        let x = e.clientX + margin;
        let y = e.clientY + margin;
        if (x + tw > window.innerWidth - 8) x = e.clientX - tw - margin;
        if (y + th > window.innerHeight - 8) y = e.clientY - th - margin;
        tipBox.style.left = x + 'px';
        tipBox.style.top  = y + 'px';
    }

    function renderCashflowCalendar() {
        const calEl = document.getElementById('cashflow-calendar');
        const labelEl = document.getElementById('cashflow-month-label');
        const summaryEl = document.getElementById('cashflow-summary');
        if (!calEl || !labelEl) return;

        const year = cashflowDate.getFullYear();
        const month = cashflowDate.getMonth();
        const monthName = cashflowDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        labelEl.textContent = monthName;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDow = new Date(year, month, 1).getDay(); // 0=Sun

        // Build EMI map for this month: day -> [{bank, emi, description}]
        const emiMap = {};
        currentLoanData.forEach(loan => {
            if (loan.monthsRemaining <= 0) return;
            const loanStart = new Date(
                parseInt(loan.rowElement.dataset.startYear),
                parseInt(loan.rowElement.dataset.startMonth) - 1,
                parseInt(loan.rowElement.dataset.startDay) || 1
            );
            const loanEnd = new Date(
                parseInt(loan.rowElement.dataset.endYear),
                parseInt(loan.rowElement.dataset.endMonth) - 1,
                parseInt(loan.rowElement.dataset.endDay) || 28
            );
            const emiDay = loan.emiDay;
            if (emiDay < 1 || emiDay > daysInMonth) return;
            const emiDate = new Date(year, month, emiDay);
            if (emiDate >= loanStart && emiDate <= loanEnd) {
                if (!emiMap[emiDay]) emiMap[emiDay] = [];
                emiMap[emiDay].push(loan);
            }
        });

        // Render calendar grid
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        let html = '<div class="cal-grid">';
        dayNames.forEach(d => { html += `<div class="cal-header-cell">${d}</div>`; });

        // Empty cells before first day
        for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell cal-empty"></div>';

        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const emis = emiMap[day] || [];
            const totalEmi = emis.reduce((s, l) => s + l.emi, 0);
            const isDanger = emis.length >= 2;
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const hasEmi = emis.length > 0;

            let cellClass = 'cal-cell';
            if (isToday) cellClass += ' cal-today';
            if (isDanger) cellClass += ' cal-danger';
            else if (hasEmi) cellClass += ' cal-has-emi';

            // Build rich tooltip HTML (rendered into a data attribute, shown via JS)
            const tooltipLines = emis.map(l =>
                `<div class="cal-tip-line"><span class="cal-tip-bank">${l.bankName}</span><span class="cal-tip-desc">${l.description}</span><span class="cal-tip-emi">₹${l.emi.toLocaleString('en-IN')}</span></div>`
            ).join('');
            const tooltipTotal = emis.length > 1
                ? `<div class="cal-tip-total">Total: ₹${totalEmi.toLocaleString('en-IN')}</div>`
                : '';
            const tooltipHtml = hasEmi
                ? `<div class="cal-tip-header">${day} ${cashflowDate.toLocaleString('default',{month:'short'})} — ${emis.length} EMI${emis.length>1?'s':''}</div>${tooltipLines}${tooltipTotal}`
                : '';

            html += `<div class="${cellClass}" data-cal-tip="${hasEmi ? encodeURIComponent(tooltipHtml) : ''}">
                <span class="cal-day-num">${day}</span>
                ${hasEmi ? `<span class="cal-emi-dot"></span>` : ''}
                ${hasEmi ? `<span class="cal-emi-total">₹${(totalEmi/1000).toFixed(0)}k</span>` : ''}
            </div>`;
        }
        html += '</div>';
        calEl.innerHTML = html;

        // Attach hover tooltip to cells with EMI data
        const tipBox = document.getElementById('cal-tooltip');
        calEl.querySelectorAll('.cal-cell[data-cal-tip]').forEach(cell => {
            const raw = cell.getAttribute('data-cal-tip');
            if (!raw) return;
            cell.addEventListener('mouseenter', (e) => {
                tipBox.innerHTML = decodeURIComponent(raw);
                tipBox.style.display = 'block';
                positionCalTip(e, tipBox);
            });
            cell.addEventListener('mousemove', (e) => positionCalTip(e, tipBox));
            cell.addEventListener('mouseleave', () => { tipBox.style.display = 'none'; });
        });

        // Summary below calendar
        const dangerDays = Object.entries(emiMap).filter(([,loans]) => loans.length >= 2);
        const totalMonthEmi = Object.values(emiMap).flat().reduce((s,l) => s + l.emi, 0);
        const emiDaysSorted = Object.keys(emiMap).map(Number).sort((a,b)=>a-b);

        let summaryHtml = `<div class="cashflow-summary-row"><span>Total EMI this month</span><strong>₹${totalMonthEmi.toLocaleString('en-IN')}</strong></div>`;
        summaryHtml += `<div class="cashflow-summary-row"><span>EMI dates</span><strong>${emiDaysSorted.join(', ')}</strong></div>`;
        if (dangerDays.length) {
            const dangerList = dangerDays.map(([d, loans]) => `${d}${['th','st','nd','rd'][[0,1,2,3].includes(+d%10) && (+d<11||+d>13) ? +d%10 : 0]||'th'} (${loans.length} EMIs, ₹${loans.reduce((s,l)=>s+l.emi,0).toLocaleString('en-IN')})`).join('; ');
            summaryHtml += `<div class="cashflow-summary-row danger-row"><span><i class="fas fa-exclamation-triangle"></i> Danger days</span><strong>${dangerList}</strong></div>`;
        }
        summaryEl.innerHTML = summaryHtml;
    }

    document.getElementById('cashflow-prev')?.addEventListener('click', () => {
        cashflowDate.setMonth(cashflowDate.getMonth() - 1);
        renderCashflowCalendar();
    });
    document.getElementById('cashflow-next')?.addEventListener('click', () => {
        cashflowDate.setMonth(cashflowDate.getMonth() + 1);
        renderCashflowCalendar();
    });

    // ================================================================
    // Hook new features into updateDashboard
    // ================================================================
    function runNewFeatures() {
        renderInterestRateComparison();
        renderCCEmiTracker();
        renderCashflowCalendar();
        populateAutoDebitLoans();
        updateReminderBadge();
        fireNotificationsIfDue();
    }

    // Initialize database
    initializeDatabase();
    updateDashboard();
    runNewFeatures();


    // ============= END LOAN DATABASE MANAGEMENT =============

});
