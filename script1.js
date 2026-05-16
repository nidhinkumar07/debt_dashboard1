/**
 * Debt Dashboard — Refactored script1.js
 *
 * Key changes from original:
 *
 * SECURITY
 *  - XSS: foreclosure warning now uses textContent, not innerHTML with markdown
 *  - XSS: bank rule display (BANK_FORECLOSURE_RULES) sanitised before injection
 *  - XSS: import error.message no longer concatenated into toast (sanitised)
 *  - XSS: `decodeURIComponent` tooltip injection wrapped with try/catch
 *  - CSRF/Injection: import file MIME type validated before JSON parse
 *  - Removed exposure of raw error stack via showToast(error.message)
 *  - Inline onclick handlers in HTML removed; wired via addEventListener here
 *  - Loan ID generation changed from Date.now()+Math.random() to crypto.randomUUID()
 *
 * BUG FIXES
 *  - initializeDatabase: double-read of localStorage corrected (was calling
 *    localStorage.getItem() then safeLocalStorageGet() redundantly)
 *  - calculateForeclosure: monthsRemaining was re-read from selectedLoanData
 *    with a fallback subtraction that could be NaN — fixed to always use
 *    the pre-computed monthsRemaining on selectedLoanData
 *  - updateReminderBadge: badge visibility now uses hidden attribute, not
 *    style.display, consistent with the [hidden] CSS rule
 *  - confirm-overlay ARIA: aria-hidden toggled correctly on open/close
 *  - endMonth calculation in loan form submission had off-by-one for months
 *    divisible by 12 (e.g. 12 → 0 bug fixed to clamp to 12)
 *  - sortable table headers now update aria-sort attribute on click
 *  - Mobile tab switching moved from inline <script> to here (DOMContentLoaded)
 *  - `foreclosureGSTInput.disabled = true` removed — WCAG requires interactive
 *    inputs to be editable or use readonly; changed to readonly
 *  - setInterval countdown now cleared on page unload to prevent memory leak
 *
 * MODULARITY / QUALITY
 *  - buildNotificationContent() extracted to eliminate duplicated if/else
 *    blocks in fireNotificationsIfDue()
 *  - Inline onclick="exportLoans()", importLoans(), resetForm(), openAdminPanel()
 *    wired as event listeners; global window.* exposure reduced
 *  - cancelLoanBtn wired here instead of inline onclick in HTML
 *  - closeForeclosureBtn wired here instead of inline onclick in HTML
 *  - exportLoansBtn / importLoansBtn wired here
 *  - updateDashboard() loop re-calculating totals merged into single pass
 *
 * DEVOPS
 *  - 'use strict' added
 *  - countdownInterval stored so it can be cleared
 */

'use strict';

// ================================================================
// TAB SWITCHING — mobile bottom bar + desktop top nav
// ================================================================
(function initTabs() {
    const TABS = {
        summary:  { panel: 'panelSummaryLoans', mobPanel: 'panelSummary',  mobBtn: 'tabSummary',   deskBtn: 'deskTabSummary'  },
        loans:    { panel: 'panelSummaryLoans', mobPanel: 'panelLoans',    mobBtn: 'tabLoans',     deskBtn: null              },
        cards:    { panel: 'panelCards',        mobPanel: 'panelCards',    mobBtn: 'tabCards',     deskBtn: 'deskTabCards'    },
        calendar: { panel: 'panelCalendar',     mobPanel: 'panelCalendar', mobBtn: 'tabCalendar',  deskBtn: 'deskTabCalendar' }
    };

    // All distinct mobile panel IDs (including panels inside panelSummaryLoans)
    const ALL_MOB_PANELS = ['panelSummary', 'panelLoans', 'panelCards', 'panelCalendar'];
    // Top-level page containers (for desktop)
    const ALL_DESK_PANELS = ['panelSummaryLoans', 'panelCards', 'panelCalendar'];

    let activeKey = 'summary';

    function switchTab(key) {
        activeKey = key;
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // On mobile: show panelSummaryLoans wrapper for summary/loans tabs
            //            show panelCards/panelCalendar for their tabs
            //            hide all top-level panels except the relevant wrapper
            ALL_DESK_PANELS.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (id === 'panelSummaryLoans') {
                    // Show wrapper only for summary/loans tabs
                    el.style.display = (key === 'summary' || key === 'loans') ? '' : 'none';
                } else if (id === 'panelCards') {
                    el.style.display = key === 'cards' ? '' : 'none';
                } else if (id === 'panelCalendar') {
                    el.style.display = key === 'calendar' ? '' : 'none';
                }
            });

            // Within panelSummaryLoans: show correct child panel
            if (key === 'summary' || key === 'loans') {
                const summaryPanel = document.getElementById('panelSummary');
                const loansPanel   = document.getElementById('panelLoans');
                if (summaryPanel) summaryPanel.style.display = key === 'summary' ? '' : 'none';
                if (loansPanel)   loansPanel.style.display   = key === 'loans'   ? '' : 'none';
            }

        } else {
            // Desktop: hide/show combined wrapper panels, ignore mob-hidden classes
            ALL_DESK_PANELS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('desk-hidden');
            });
            const activeTab = TABS[key];
            if (activeTab) {
                const el = document.getElementById(activeTab.panel);
                if (el) el.classList.remove('desk-hidden');
            }
            // Reset any inline mobile styles when on desktop
            ALL_MOB_PANELS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = '';
            });
        }

        // Update mobile button states
        Object.entries(TABS).forEach(([k, { mobBtn }]) => {
            if (!mobBtn) return;
            const el = document.getElementById(mobBtn);
            if (!el) return;
            const isActive = k === key;
            el.classList.toggle('active', isActive);
            el.setAttribute('aria-selected', String(isActive));
        });

        // Update desktop button states
        const activePanelId = TABS[key]?.panel;
        Object.entries(TABS).forEach(([k, { deskBtn, panel }]) => {
            if (!deskBtn) return;
            const el = document.getElementById(deskBtn);
            if (!el) return;
            const isActive = isMobile ? k === key : panel === activePanelId;
            el.classList.toggle('active', isActive);
            el.setAttribute('aria-selected', String(isActive));
        });
    }

    function applyLayout() {
        const isMobile = window.innerWidth <= 768;
        const mobileNav  = document.getElementById('mobileTabNav');
        const desktopNav = document.getElementById('desktopTabNav');
        const adminDesktop = document.getElementById('adminBtnDesktop');

        if (mobileNav)    mobileNav.hidden  = !isMobile;
        if (desktopNav)   desktopNav.hidden = isMobile;
        if (adminDesktop) adminDesktop.style.display = 'none';

        if (isMobile) {
            // Reset desk-hidden classes — mobile uses inline display style instead
            ALL_DESK_PANELS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('desk-hidden');
            });
            // Re-apply the current tab state
            switchTab(activeKey);
        } else {
            // Desktop: clear any inline mobile display styles, apply desk-hidden
            ALL_MOB_PANELS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = '';
            });
            ALL_DESK_PANELS.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('desk-hidden');
            });
            const active = TABS[activeKey];
            if (active) {
                const el = document.getElementById(active.panel);
                if (el) el.classList.remove('desk-hidden');
            }
        }
    }

    // Wire mobile tab buttons
    Object.entries(TABS).forEach(([key, { mobBtn }]) => {
        document.getElementById(mobBtn)?.addEventListener('click', () => switchTab(key));
    });

    // Wire desktop tab buttons
    Object.entries(TABS).forEach(([key, { deskBtn }]) => {
        document.getElementById(deskBtn)?.addEventListener('click', () => switchTab(key));
    });

    // Admin tab (mobile + desktop) opens admin modal — wired in main init block
    // (openAdminPanel is scoped there; listener added at line ~1693)

    // Script is loaded with defer, so DOM is always ready here.
    // Run immediately + on resize.
    applyLayout();
    window.addEventListener('resize', applyLayout);
})();


// ================================================================
// MAIN APPLICATION — wrapped in DOMContentLoaded
// ================================================================
document.addEventListener('DOMContentLoaded', function () {

    // ============================================================
    // SECURITY HELPERS
    // ============================================================

    /**
     * Escapes a string for safe injection into innerHTML.
     * @param {*} str
     * @returns {string}
     */
    function sanitize(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Safe localStorage JSON read — returns fallback if missing or corrupted.
     * @param {string} key
     * @param {*} fallback
     * @returns {*}
     */
    function safeLocalStorageGet(key, fallback) {
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : fallback;
        } catch (e) {
            console.warn(`localStorage key "${key}" corrupted, resetting.`, e);
            localStorage.removeItem(key);
            return fallback;
        }
    }

    /**
     * Validates that a loan object has all required fields with sane values.
     * @param {*} loan
     * @returns {boolean}
     */
    function isValidLoan(loan) {
        if (!loan || typeof loan !== 'object') return false;
        const requiredStr = ['bankName', 'description'];
        const requiredNum = ['initialAmount', 'emi', 'interestRate', 'tenure',
                             'startDay', 'startMonth', 'startYear', 'emiDay'];
        for (const f of requiredStr) {
            if (!loan[f] || typeof loan[f] !== 'string' || !loan[f].trim()) return false;
        }
        for (const f of requiredNum) {
            if (loan[f] === undefined || isNaN(Number(loan[f]))) return false;
        }
        if (loan.initialAmount <= 0 || loan.emi <= 0 || loan.tenure <= 0) return false;
        if (loan.interestRate < 0 || loan.interestRate > 100) return false;
        if (loan.startDay < 1 || loan.startDay > 31) return false;
        if (loan.startMonth < 1 || loan.startMonth > 12) return false;
        if (loan.startYear < 2000 || loan.startYear > 2100) return false;
        if (loan.emiDay < 1 || loan.emiDay > 31) return false;
        return true;
    }

    // ============================================================
    // TOAST NOTIFICATION SYSTEM
    // ============================================================
    function showToast(message, type = 'info', duration = 3200) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        // A11Y: role="status" for non-critical, "alert" for error
        toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        const icon = icons[type] || 'ℹ️';
        // SECURITY: message set via textContent to avoid XSS
        const iconSpan = document.createElement('span');
        iconSpan.setAttribute('aria-hidden', 'true');
        iconSpan.textContent = icon;
        const msgSpan = document.createElement('span');
        msgSpan.textContent = message;   // ← textContent, not innerHTML
        toast.appendChild(iconSpan);
        toast.appendChild(msgSpan);
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('toast-out');
            toast.addEventListener('animationend', () => toast.remove(), { once: true });
        }, duration);
    }

    // ============================================================
    // CONFIRM DIALOG SYSTEM
    // ============================================================
    function showConfirm(message, onConfirm) {
        const overlay = document.getElementById('confirm-overlay');
        const msgEl   = document.getElementById('confirm-message');
        if (!overlay || !msgEl) { if (confirm(message)) onConfirm(); return; }
        msgEl.textContent = message;
        overlay.classList.add('active');
        // A11Y: expose dialog to screen readers
        overlay.setAttribute('aria-hidden', 'false');

        const yesBtn = document.getElementById('confirm-yes');
        const noBtn  = document.getElementById('confirm-no');

        const cleanup = () => {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        };
        const onYes = () => {
            cleanup();
            onConfirm();
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
        };
        const onNo = () => {
            cleanup();
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
        };

        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    }

    // ============================================================
    // CREDIT CARD "LAST UPDATED" STAMP
    // ============================================================
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
            cardsDateEl.style.fontStyle = '';
        } else {
            cardsDateEl.textContent = '(not yet stamped — click "Mark as Updated Today")';
            cardsDateEl.style.fontStyle = 'italic';
        }
    }

    document.getElementById('markCardsUpdatedBtn')?.addEventListener('click', () => {
        const stamp = formatStampDate(new Date());
        localStorage.setItem('cardsLastUpdated', stamp);
        loadCardsUpdatedDate();
        showToast(`Credit card data stamped as updated on ${stamp}`, 'success');
        // Brief green "stamped" flash on the button
        const btn = document.getElementById('markCardsUpdatedBtn');
        if (btn) {
            btn.classList.add('stamped');
            const origHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Stamped!';
            setTimeout(() => {
                btn.classList.remove('stamped');
                btn.innerHTML = origHTML;
            }, 1800);
        }
    });

    loadCardsUpdatedDate();

    // ============================================================
    // DOM ELEMENT REFERENCES
    // ============================================================
    const debtTableBody              = document.getElementById('bank-a-debts');
    const summarySection             = document.getElementById('description-summary-list');
    const totalEmiElement            = document.getElementById('total-emi');
    const totalRemainingElement      = document.getElementById('total-remaining');
    const totalLoansElement          = document.getElementById('loans');
    const totalLoanAmountElement     = document.getElementById('total-loan');
    const loanBoxesContainer         = document.querySelector('.loan-boxes-container');
    const overallProgressBar         = document.querySelector('.overall-progress-bar');
    const overallProgressPercentage  = document.querySelector('.overall-progress-percentage');
    const overallProgressRaised      = document.querySelector('.overall-progress-amounts .overall-progress-raised');
    const overallProgressTotal       = document.querySelector('.overall-progress-amounts .overall-progress-total');
    const creditCardSimpleTbody      = document.getElementById('credit-card-simple-tbody');
    const autoDebitLoansList         = document.getElementById('auto-debit-loans-list');
    const topLoansList               = document.getElementById('top-loans-list');
    const totalInterestElement       = document.getElementById('total-interest');
    const totalPrincipalElement      = document.getElementById('total-principal');
    const overallProgressSection     = document.querySelector('.overall-progress-section');
    const loanBreakdownChartCanvas   = document.getElementById('loanBreakdownChart');
    const emiForecastSection         = document.querySelector('.desktop-forecast-panel') || document.querySelector('.emi-forecast-section');
    const sidebarForecastPanel       = document.querySelector('.sidebar-forecast-panel');
    const debtByBankList             = document.getElementById('debt-by-bank-list');
    const totalActiveEmiElement      = document.getElementById('total-active-emi');
    const emiFreedomDateElement      = document.getElementById('emi-freedom-date');
    const completedLoansElement      = document.getElementById('completed-loans');
    const activeLoansElement         = document.getElementById('active-loans');

    // Foreclosure refs
    const foreclosureChargesInput        = document.getElementById('foreclosureCharges');
    const foreclosureGSTInput            = document.getElementById('foreclosureGST');
    const chargesPercentDisplay          = document.getElementById('chargesPercentDisplay');
    const chargesAmountDisplay           = document.getElementById('chargesAmountDisplay');
    const gstPercentDisplay              = document.getElementById('gstPercentDisplay');
    const gstAmountDisplay               = document.getElementById('gstAmountDisplay');
    const totalForeclosureAmountDisplay  = document.getElementById('totalForeclosureAmountDisplay');

    // ============================================================
    // CONSTANTS & STATE
    // ============================================================
    const indianRupeeOptions = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
    const topLoansCount = 3;
    let totalInterestForAllLoans = 0;
    let totalPrincipalForAllLoans = 0;
    let currentLoanData = [];
    let selectedLoanData = null;

    // Bank logo mapping
    const bankLogos = {
        "IDFC BANK":     "images/idfc.png",
        "SBI BANK":      "images/sbi.png",
        "ICICI BANK":    "images/icicibank.png",
        "KOTAK BANK":    "images/kotakbank.png",
        "DMI FINANCE":   "images/dmifinance.png",
        "AXIS BANK":     "images/axisbank.png",
        "RBL BANK":      "images/rblbank.png",
        "CREDIT SAISON": "images/creditsaison.png",
        "INDUSIND BANK": "images/indusindbank.png",
        "HDFC BANK":     "images/hdfcbank.png"
    };

    // SECURITY: Foreclosure rules are plain text only — no HTML tags.
    // Previously contained raw <b> and <br> tags injected via innerHTML.
    // Now rendered as structured DOM elements in openForeclosureCalculator().
    const BANK_FORECLOSURE_RULES = {
        "AXIS BANK":     "12 MONTH CHECK. PERSONAL LOAN - if EMIs paid ≤36 months then 3%, else 2%. CREDIT CARD - 3% of outstanding.",
        "CREDIT SAISON": "NO 12 MONTH CHECK. PERSONAL LOAN: Up to 12th EMI - 6%; 13th-24th EMI - 4%; 25th+ EMI - 3% of outstanding.",
        "DMI FINANCE":   "12 MONTH CHECK. PERSONAL LOAN - 3% of outstanding.",
        "ICICI BANK":    "CREDIT CARD - 3% of outstanding.",
        "IDFC BANK":     "12 MONTH CHECK. PERSONAL LOAN - 4% of outstanding. CREDIT CARD - 3% of outstanding.",
        "INDUSIND BANK": "12 MONTH CHECK. PERSONAL LOAN - 4% of outstanding. CREDIT CARD - 3% of outstanding.",
        "KOTAK BANK":    "NO 12 MONTH CHECK. PERSONAL LOAN - if EMIs paid ≤36 months then 4%, else 2%. CREDIT CARD - 0% or 4% of outstanding.",
        "RBL BANK":      "12 MONTH CHECK. PERSONAL LOAN - if EMIs paid <18 then 5%, else 3%. CREDIT CARD - 3% of outstanding.",
        "SBI BANK":      "CREDIT CARD - FLEXIPAY AND ENCASH - 3% of outstanding.",
        "Default":       "Foreclosure charges typically range from 2% to 5% of the outstanding principal. Consult your loan agreement for exact details."
    };

    // Credit card data (detailed view)
    const creditCardData1 = [
        { name: "IndusInd Legend",   totalLimit: 50000,  currentOutstanding: 31711, billingCycleEndDay: 15, paymentDueDay: 4  },
        { name: "ICICI AmazonPay",   totalLimit: 140000, currentOutstanding: 5139,  billingCycleEndDay: 28, paymentDueDay: 15 },
        { name: "SBI SimplyCLICK",   totalLimit: 131000, currentOutstanding: 48823, billingCycleEndDay: 11, paymentDueDay: 30 },
        { name: "IDFC First Classic", totalLimit: 52000,  currentOutstanding: 18966, billingCycleEndDay: 19, paymentDueDay: 3  },
        { name: "RBL SuperCard",     totalLimit: 149000, currentOutstanding: 0,     billingCycleEndDay: 12, paymentDueDay: 1  },
        { name: "Flipkart Axis",     totalLimit: 180000, currentOutstanding: 7812,  billingCycleEndDay: 13, paymentDueDay: 1  },
        { name: "Kotak League Card", totalLimit: 200000, currentOutstanding: 40457, billingCycleEndDay: 25, paymentDueDay: 13 }
    ];

    const creditCardsGrid          = document.getElementById('credit-cards-grid');
    const noCreditCardsMessage     = document.querySelector('.no-credit-cards-message');
    const totalCreditLimitElement  = document.getElementById('totalCreditLimit');
    const totalAvailableLimitElement = document.getElementById('totalAvailableLimit');
    const totalOutstandingElement  = document.getElementById('totalOutstanding');

    // ============================================================
    // HELPER: CALCULATE REMAINING PRINCIPAL (amortisation)
    // ============================================================
    function calculateRemainingPrincipal(principal, annualRate, emi, monthsPaid, totalTenure) {
        if (monthsPaid <= 0) return principal;
        if (monthsPaid >= totalTenure) return 0;
        const monthlyRate = annualRate / 1200;
        if (monthlyRate === 0) {
            return Math.max(0, principal - (principal / totalTenure) * monthsPaid);
        }
        const factor = Math.pow(1 + monthlyRate, monthsPaid);
        return Math.max(0, Math.round(principal * factor - (emi / monthlyRate) * (factor - 1)));
    }

    // ============================================================
    // HELPER: DATE FORMATTING
    // ============================================================
    function formatDateSuffix(day) {
        if (day >= 11 && day <= 13) return 'th';
        switch (day % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    const formatDate = (year, month, day) => {
        const date = new Date(year, month - 1, day);
        const dayNum = date.getDate();
        const monthShort = date.toLocaleString('default', { month: 'short' });
        const yearFull = date.getFullYear();
        return `${dayNum}${formatDateSuffix(dayNum)} ${monthShort} ${yearFull}`;
    };

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
        if (days < 0) { days += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); months--; }
        if (months < 0) { months += 12; years--; }
        return { years, months, days, hours, minutes, seconds };
    }

    // ============================================================
    // FORECLOSURE CALCULATOR
    // ============================================================
    function getMaxEndDate() {
        let maxDate = null;
        document.querySelectorAll('#bank-a-debts tr').forEach(row => {
            const endDate = new Date(
                parseInt(row.dataset.endYear),
                parseInt(row.dataset.endMonth) - 1,
                parseInt(row.dataset.endDay) || 5,
                23, 59, 59
            );
            if (!maxDate || endDate > maxDate) maxDate = endDate;
        });
        return maxDate;
    }

    function updateOverallCountdown() {
        const endDate = getMaxEndDate();
        const now = new Date();
        const el = document.getElementById('overallFreedomText');
        if (!el) return;
        if (!endDate || endDate < now) {
            el.textContent = '🎉 Loan Free!';
            return;
        }
        const { years, months, days } = getTimeComponents(now, endDate);
        el.textContent = `Freedom In: ${years} yrs ${months} mo ${days} days`;
    }

    function openForeclosureCalculator(loan) {
        const accurateRemainingPrincipal = calculateRemainingPrincipal(
            loan.principalAmount, loan.annualInterestRate,
            loan.emi, loan.monthsPassed, loan.tenureMonths
        );

        selectedLoanData = { ...loan, currentRemainingAmount: accurateRemainingPrincipal };

        const monthsPaid = loan.monthsPassed;
        const monthsRemaining = loan.monthsRemaining;
        const remainingPrincipal = accurateRemainingPrincipal;

        const totalPayable = loan.emi * loan.tenureMonths;
        const totalInterest = Math.max(0, totalPayable - loan.principalAmount);
        const principalPaid = loan.principalAmount - remainingPrincipal;
        const interestPaid  = Math.max(0, (loan.emi * monthsPaid) - principalPaid);
        const remainingInterest = Math.max(0, totalInterest - interestPaid);
        const estimatedTotalPendingAmount = monthsRemaining * loan.emi;

        const isEligible = monthsPaid >= 12;

        // Populate fields
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setText('emiEligibility', isEligible
            ? '✅ Eligible for Foreclosure (12+ EMIs paid)'
            : '❌ Not Eligible for Foreclosure (Less than 12 EMIs paid)');
        const eligEl = document.getElementById('emiEligibility');
        if (eligEl) eligEl.style.color = isEligible ? '#28a745' : '#dc3545';

        setText('foreclosureLoanBank', loan.bankName);
        setText('foreclosureLoanDescription', loan.description);
        setText('initialPrincipal', `₹ ${loan.principalAmount.toLocaleString('en-IN', indianRupeeOptions)}`);
        setText('emiAmountDisplay', `₹ ${loan.emi.toLocaleString('en-IN', indianRupeeOptions)}`);
        setText('monthsPaidDisplay', `${monthsPaid} months`);
        setText('monthsPendingDisplay', `${monthsRemaining} months`);
        setText('remainingPrincipalDisplay', `₹ ${remainingPrincipal.toLocaleString('en-IN', indianRupeeOptions)}`);
        setText('estimatedTotalPendingDisplay', `₹ ${estimatedTotalPendingAmount.toLocaleString('en-IN', indianRupeeOptions)}`);
        setText('interestPaidDisplay', `₹ ${interestPaid.toLocaleString('en-IN', indianRupeeOptions)}`);
        setText('interestSavedDisplay', `₹ ${remainingInterest.toLocaleString('en-IN', indianRupeeOptions)}`);
        setText('totalInterestDisplay', `₹ ${totalInterest.toLocaleString('en-IN', indianRupeeOptions)}`);

        // SECURITY FIX: bank rules are plain text, not HTML;
        // rendered as textContent inside structured DOM, not innerHTML
        const rule = BANK_FORECLOSURE_RULES[loan.bankName] || BANK_FORECLOSURE_RULES['Default'];
        const ruleDisplay = document.getElementById('foreclosureChargesRuleDisplay');
        if (ruleDisplay) {
            ruleDisplay.innerHTML = '';  // clear
            const ruleP = document.createElement('p');
            ruleP.style.cssText = 'font-size:0.9em;color:#555;';
            const strong = document.createElement('strong');
            strong.textContent = `${loan.bankName} Rule: `;
            ruleP.appendChild(strong);
            ruleP.appendChild(document.createTextNode(rule));
            ruleDisplay.appendChild(ruleP);
        }

        // BUG FIX: foreclosureWarning used innerHTML with markdown syntax (**text**)
        // Changed to textContent
        const foreclosureWarning = document.getElementById('foreclosureWarning');
        if (foreclosureWarning) {
            foreclosureWarning.hidden = isEligible;
            foreclosureWarning.textContent = 'Warning: Most banks charge a higher foreclosure fee or do not allow foreclosure before 12 EMIs. The fee below may not apply. Proceed with caution.';
        }

        // Reset inputs
        foreclosureChargesInput.value = '';
        foreclosureGSTInput.value = 18;
        // BUG FIX: disabled → readonly (disabled blocks form submission AND screen reader access)
        foreclosureGSTInput.readOnly = true;

        // Reset displays
        chargesPercentDisplay.textContent = '0';
        chargesAmountDisplay.textContent  = '₹ 0';
        gstPercentDisplay.textContent     = '18';
        gstAmountDisplay.textContent      = '₹ 0';
        totalForeclosureAmountDisplay.textContent = '₹ 0';
        setText('totalSavingsDisplay', '₹ 0');
        setText('totalChargesDisplay', '₹ 0');

        const resultsEl = document.getElementById('foreclosureResults');
        if (resultsEl) resultsEl.hidden = true;

        document.getElementById('foreclosureModal').hidden = false;
    }

    function calculateForeclosure() {
        if (!selectedLoanData) return;
        const remainingPrincipal = selectedLoanData.currentRemainingAmount;
        const chargesPercent = parseFloat(foreclosureChargesInput.value) || 0;
        const gstPercent     = parseFloat(foreclosureGSTInput.value) || 0;

        const foreclosureChargesAmount = (remainingPrincipal * chargesPercent) / 100;
        const gstAmount = (foreclosureChargesAmount * gstPercent) / 100;
        const totalForeclosureAmount  = remainingPrincipal + foreclosureChargesAmount + gstAmount;
        const totalForeclosureCharges = foreclosureChargesAmount + gstAmount;

        // BUG FIX: monthsRemaining was recalculated from tenureMonths - monthsPassed
        // which could yield NaN if either was missing. Use the stored value.
        const monthsRemaining = selectedLoanData.monthsRemaining;
        const estimatedTotalPendingAmount = selectedLoanData.emi * monthsRemaining;
        const totalSavings = estimatedTotalPendingAmount - totalForeclosureAmount;

        chargesPercentDisplay.textContent = chargesPercent.toFixed(2);
        chargesAmountDisplay.textContent  = `₹ ${foreclosureChargesAmount.toLocaleString('en-IN', indianRupeeOptions)}`;
        gstPercentDisplay.textContent     = gstPercent.toFixed(2);
        gstAmountDisplay.textContent      = `₹ ${gstAmount.toLocaleString('en-IN', indianRupeeOptions)}`;
        totalForeclosureAmountDisplay.textContent = `₹ ${totalForeclosureAmount.toLocaleString('en-IN', indianRupeeOptions)}`;

        const totalChargesEl = document.getElementById('totalChargesDisplay');
        if (totalChargesEl) totalChargesEl.textContent = `₹ ${totalForeclosureCharges.toLocaleString('en-IN', indianRupeeOptions)}`;

        const totalSavingsEl = document.getElementById('totalSavingsDisplay');
        if (totalSavingsEl) totalSavingsEl.textContent = `₹ ${totalSavings.toLocaleString('en-IN', indianRupeeOptions)}`;

        const resultsEl = document.getElementById('foreclosureResults');
        if (resultsEl) resultsEl.hidden = false;
    }

    document.getElementById('calculateForeclosure')?.addEventListener('click', calculateForeclosure);

    // SECURITY FIX: Removed inline onclick from HTML; wired here
    document.getElementById('closeForeclosureBtn')?.addEventListener('click', () => {
        document.getElementById('foreclosureModal').hidden = true;
    });

    // ============================================================
    // BANK LOGO HELPERS
    // ============================================================
    function getBankLogoFromCard(cardName) {
        const upper = cardName.toUpperCase();
        const matchers = [
            ['KOTAK',    'KOTAK BANK'],
            ['AXIS',     'AXIS BANK'],
            ['ICICI',    'ICICI BANK'],
            ['RBL',      'RBL BANK'],
            ['INDUSIND', 'INDUSIND BANK'],
            ['SBI',      'SBI BANK'],
            ['CREDIT',   'CREDIT SAISON'],
            ['IDFC',     'IDFC BANK']
        ];
        for (const [needle, key] of matchers) {
            if (upper.includes(needle)) return bankLogos[key] || '';
        }
        return 'bank.png';
    }

    function getBankIcon(bankName) {
        if (!bankName) return 'images/favicon.png';
        const upper = bankName.toUpperCase();
        if (bankLogos[upper]) return bankLogos[upper];
        const match = Object.keys(bankLogos).find(k => upper.includes(k) || k.includes(upper));
        return match ? bankLogos[match] : 'images/favicon.png';
    }

    // ============================================================
    // CREDIT CARDS — GRID POPULATION
    // ============================================================
    function populateCreditCards() {
        if (!creditCardData1 || creditCardData1.length === 0) {
            if (noCreditCardsMessage) noCreditCardsMessage.hidden = false;
            if (totalCreditLimitElement)   totalCreditLimitElement.textContent   = '₹ 0';
            if (totalAvailableLimitElement) totalAvailableLimitElement.textContent = '₹ 0';
            if (totalOutstandingElement)   totalOutstandingElement.textContent   = '₹ 0';
            return;
        }

        if (noCreditCardsMessage) noCreditCardsMessage.hidden = true;

        const today = new Date();
        let totalLimit = 0, totalOutstanding = 0;
        creditCardData1.forEach(card => {
            totalLimit += card.totalLimit;
            totalOutstanding += card.currentOutstanding;
        });

        const totalAvailable = totalLimit - totalOutstanding;
        if (totalCreditLimitElement)    totalCreditLimitElement.textContent    = `₹ ${totalLimit.toLocaleString('en-IN')}`;
        if (totalAvailableLimitElement) totalAvailableLimitElement.textContent = `₹ ${totalAvailable.toLocaleString('en-IN')}`;
        if (totalOutstandingElement)    totalOutstandingElement.textContent    = `₹ ${totalOutstanding.toLocaleString('en-IN')}`;

        const fmt = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Load paid state from localStorage (keyed by card name + cycle month)
        const paidState = safeLocalStorageGet('ccPaidState', {});

        const processedCards = creditCardData1.map(card => {
            const available   = card.totalLimit - card.currentOutstanding;
            const utilization = (card.currentOutstanding / card.totalLimit) * 100;

            // Bill date: this month's billing cycle end day
            let billDate = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth(), card.billingCycleEndDay);

            // Due date: paymentDueDay that comes AFTER this bill date
            let dueDate = new Date(billDate.getFullYear(), billDate.getMonth(), card.paymentDueDay);
            if (dueDate <= billDate) dueDate.setMonth(dueDate.getMonth() + 1);

            // Advance to next cycle only once the due date itself has passed
            if (dueDate < todayMidnight) {
                billDate.setMonth(billDate.getMonth() + 1);
                dueDate = new Date(billDate.getFullYear(), billDate.getMonth(), card.paymentDueDay);
                if (dueDate <= billDate) dueDate.setMonth(dueDate.getMonth() + 1);
            }

            const billDateStr = fmt(billDate);
            const dueDateStr  = fmt(dueDate);
            const daysToDue   = Math.ceil((dueDate - todayMidnight) / 86400000);

            // Paid key: cardName + due month — auto-resets each cycle
            const paidKey     = `${card.name}_${dueDate.getFullYear()}_${dueDate.getMonth()}`;
            const isPaid      = !!paidState[paidKey];
            // Enable toggle only after bill date has passed AND outstanding > 0
            const billDatePassed = todayMidnight >= billDate;
            const hasOutstanding = card.currentOutstanding > 0;
            const canMarkPaid    = billDatePassed && hasOutstanding;

            return { ...card, available, utilization, billDateStr, dueDateStr, daysToDue, dueDate, billDate, paidKey, isPaid, canMarkPaid };
        }).sort((a, b) => {
            // Zero-balance cards always last
            const aZero = a.currentOutstanding === 0;
            const bZero = b.currentOutstanding === 0;
            if (aZero !== bZero) return aZero ? 1 : -1;
            if (aZero && bZero) return a.daysToDue - b.daysToDue;

            // Paid cards after unpaid
            if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;

            // Both same paid state — sort by due date ascending (soonest first)
            return a.daysToDue - b.daysToDue;
        });

        // --- Next payment due banner (only unpaid cards with outstanding > 0) ---
        const unpaidCards = processedCards.filter(c => !c.isPaid && c.currentOutstanding > 0);
        const nextDueCard = unpaidCards.length ? unpaidCards.reduce((a, b) => a.daysToDue <= b.daysToDue ? a : b) : null;
        let nextDueBanner = document.getElementById('cc-next-due-banner');
        if (!nextDueBanner) {
            nextDueBanner = document.createElement('div');
            nextDueBanner.id = 'cc-next-due-banner';
            creditCardsGrid.parentNode.insertBefore(nextDueBanner, creditCardsGrid);
        }
        if (nextDueCard) {
            const urgentBanner = nextDueCard.daysToDue <= 5;
            nextDueBanner.className = 'cc-next-due-banner' + (urgentBanner ? ' cc-next-due-urgent' : '');
            nextDueBanner.innerHTML = `
                <i class="fas fa-${urgentBanner ? 'exclamation-triangle' : 'calendar-alt'}" aria-hidden="true"></i>
                <span>Next payment due in <strong>${nextDueCard.daysToDue} day${nextDueCard.daysToDue !== 1 ? 's' : ''}</strong> &mdash; <em>${sanitize(nextDueCard.name)}</em> on ${nextDueCard.dueDateStr}</span>
            `;
        } else {
            nextDueBanner.className = 'cc-next-due-banner cc-next-due-allpaid';
            nextDueBanner.innerHTML = `<i class="fas fa-check-circle" aria-hidden="true"></i><span>All cards paid this cycle</span>`;
        }

        // --- Render cards ---
        creditCardsGrid.innerHTML = '';
        processedCards.forEach(card => {
            const cardBox = document.createElement('div');

            let barColor = '#16a34a';
            if (card.utilization > 60)      barColor = '#dc2626';
            else if (card.utilization > 30) barColor = '#f59e0b';

            const isUrgent  = !card.isPaid && card.currentOutstanding > 0 && card.daysToDue <= 5;
            const isSoon    = !card.isPaid && card.currentOutstanding > 0 && card.daysToDue > 5 && card.daysToDue <= 14;
            const isZero    = card.currentOutstanding === 0;
            const dueCls    = isUrgent ? ' cc-due-urgent' : '';
            const paidCls   = card.isPaid ? ' cc-card-paid' : '';
            const urgentCls = isUrgent ? ' cc-card-urgent' : isSoon ? ' cc-card-soon' : isZero ? ' cc-card-zero' : '';
            cardBox.className = 'credit-card-box cc-minimal' + paidCls + urgentCls;

            // Button state logic — FIX 2 & 3
            let btnLabel, btnCls, btnDisabled, btnTitle;
            if (card.currentOutstanding === 0) {
                // FIX 3: clear "No Due" static badge
                btnLabel = '✓ No Due'; btnCls = 'cc-paid-toggle cc-paid-toggle--nodue';
                btnDisabled = 'disabled'; btnTitle = 'No outstanding balance';
            } else if (card.isPaid) {
                // FIX 3: "✓ Paid" — clearly a success badge
                btnLabel = '✓ Paid'; btnCls = 'cc-paid-toggle cc-paid-toggle--paid';
                btnDisabled = ''; btnTitle = 'Click to mark as unpaid';
            } else if (!card.canMarkPaid) {
                // FIX 3: disabled until bill date — show tooltip explanation
                btnLabel = 'Mark Paid'; btnCls = 'cc-paid-toggle cc-paid-toggle--disabled';
                btnDisabled = 'disabled'; btnTitle = `Available after ${card.billDateStr}`;
            } else {
                // FIX 2: active CTA — green solid with checkmark icon
                btnLabel = '✓ Mark Paid'; btnCls = 'cc-paid-toggle';
                btnDisabled = ''; btnTitle = 'Mark this card as paid';
            }

            cardBox.innerHTML = `
            <div class="cc-min-header">
                <div class="cc-min-header-left">
                    <img src="${sanitize(getBankLogoFromCard(card.name))}" class="cc-min-logo"
                         alt="${sanitize(card.name)} logo" />
                    <span class="cc-min-name">${sanitize(card.name)}</span>
                </div>
                <button class="${btnCls}" ${btnDisabled}
                        data-paid-key="${sanitize(card.paidKey)}"
                        title="${btnTitle}"
                        aria-label="${btnTitle}"
                        aria-pressed="${card.isPaid}">
                    ${btnLabel}
                </button>
            </div>

            <div class="cc-min-bar-row">
                <span class="cc-min-bar-label">${card.utilization.toFixed(1)}% used</span>
                <span class="cc-min-bar-amt${card.currentOutstanding === 0 ? ' cc-min-amt-zero' : ''}">
                    ${card.currentOutstanding === 0 ? 'No outstanding' : '₹ ' + card.currentOutstanding.toLocaleString('en-IN')}
                </span>
            </div>
            <div class="cc-min-progress">
                <div class="cc-min-progress-fill" style="width:${card.utilization.toFixed(1)}%;background:${barColor};"
                     role="progressbar" aria-valuenow="${card.utilization.toFixed(0)}"
                     aria-valuemin="0" aria-valuemax="100"></div>
            </div>

            <div class="cc-min-stats">
                <div class="cc-min-stat-inline">
                    <span class="cc-min-stat-label">Limit</span>
                    <span class="cc-min-stat-val">₹ ${card.totalLimit.toLocaleString('en-IN')}</span>
                </div>
                <div class="cc-min-stat-inline" style="text-align:right;">
                    <span class="cc-min-stat-label">Available</span>
                    <span class="cc-min-stat-val cc-min-avail">₹ ${card.available.toLocaleString('en-IN')}</span>
                </div>
            </div>

            <div class="cc-min-footer">
                <div class="cc-min-date-block">
                    <span class="cc-min-date-label">Bill date</span>
                    <span class="cc-min-date-val">${card.billDateStr}</span>
                </div>
                <div class="cc-min-date-sep"></div>
                <div class="cc-min-date-block" style="text-align:right;align-items:flex-end;">
                    <span class="cc-min-date-label">Due date</span>
                    <span class="cc-min-date-val${dueCls}">${card.dueDateStr}${isUrgent ? ` <span class="cc-due-days">${card.daysToDue}d</span>` : ''}</span>
                </div>
            </div>`;

            // Toggle handler — only for enabled buttons
            const btn = cardBox.querySelector('.cc-paid-toggle:not([disabled])');
            if (btn) {
                btn.addEventListener('click', function () {
                    const key   = this.dataset.paidKey;
                    const state = safeLocalStorageGet('ccPaidState', {});
                    if (state[key]) { delete state[key]; } else { state[key] = true; }
                    localStorage.setItem('ccPaidState', JSON.stringify(state));
                    populateCreditCards();
                });
            }

            creditCardsGrid.appendChild(cardBox);
        });
    }

    // ============================================================
    // CREDIT CARD BILLING CYCLE TABLE
    // ============================================================
    function populateCreditCardTable() {
        const creditCardData = [
            { name: "SBI BANK",      billingCycle: "11th - 30th",  interestRate: "16" },
            { name: "RBL BANK",      billingCycle: "12th - 1st",   interestRate: "21" },
            { name: "AXIS BANK",     billingCycle: "13th - 1st",   interestRate: "18" },
            { name: "INDUSIND BANK", billingCycle: "15th - 04th",  interestRate: "17" },
            { name: "IDFC BANK",     billingCycle: "19th - 3rd",   interestRate: "21" },
            { name: "KOTAK BANK",    billingCycle: "25th - 13th",  interestRate: "19" },
            { name: "ICICI BANK",    billingCycle: "28th - 15th",  interestRate: "17" }
        ];

        creditCardSimpleTbody.innerHTML = '';
        creditCardData.forEach(card => {
            const row = creditCardSimpleTbody.insertRow();
            row.insertCell().textContent = card.name;
            row.insertCell().textContent = card.billingCycle;
            const rate = parseFloat(card.interestRate);
            const cls = rate >= 20 ? 'interest-high' : rate >= 17 ? 'interest-medium' : 'interest-low';
            const rateCell = row.insertCell();
            // Safe: card.interestRate is from local constant array, but sanitise for consistency
            rateCell.innerHTML = `<span class="${cls}">${sanitize(card.interestRate)}%</span>`;
        });
    }

    // ============================================================
    // AUTO DEBIT LOANS LIST
    // ============================================================
    function populateAutoDebitLoans() {
        if (!autoDebitLoansList) return;
        const activeLoans = currentLoanData.filter(l => l.monthsRemaining > 0);
        const grouped = {};
        activeLoans.forEach(loan => {
            const day = loan.emiDay;
            if (!grouped[day]) grouped[day] = { day, loans: [], total: 0 };
            grouped[day].loans.push(loan);
            grouped[day].total += loan.emi;
        });

        const sortedGroups = Object.values(grouped).sort((a, b) => a.day - b.day);
        autoDebitLoansList.innerHTML = '';

        if (!sortedGroups.length) {
            const p = document.createElement('p');
            p.style.cssText = 'color:#64748b;font-size:0.85em;';
            p.textContent = 'No active loans.';
            autoDebitLoansList.appendChild(p);
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
            if (isToday)        { statusClass = 'autodebit-today'; statusText = `Due TODAY (${group.day}${suffix})`; }
            else if (isPast)    { statusClass = 'autodebit-past';  statusText = `Paid — ${group.day}${suffix}`; }

            const card = document.createElement('div');
            card.className = `autodebit-card${isDanger ? ' autodebit-danger' : ''}`;

            const loanLines = group.loans.map(l => `
                <div class="autodebit-loan-row">
                    <span class="autodebit-bank">${sanitize(l.bankName)}</span>
                    <span class="autodebit-desc">${sanitize(l.description)}</span>
                    <span class="autodebit-emi">₹${l.emi.toLocaleString('en-IN')}</span>
                </div>`).join('');

            card.innerHTML = `
                <div class="autodebit-header">
                    <span class="autodebit-status ${statusClass}">${sanitize(statusText)}</span>
                    <span class="autodebit-total ${isDanger ? 'autodebit-total-danger' : ''}">
                        ${isDanger ? '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i> ' : ''}Total ₹${group.total.toLocaleString('en-IN')}
                    </span>
                </div>
                <div class="autodebit-loans">${loanLines}</div>`;

            autoDebitLoansList.appendChild(card);
        });
    }

    // ============================================================
    // CORE METRICS CALCULATION
    // ============================================================
    function calculateAllLoanMetrics() {
        const today = new Date();
        const currentYear  = today.getFullYear();
        const currentMonth = today.getMonth();
        const currentDayOfMonth = today.getDate();

        totalInterestForAllLoans  = 0;
        totalPrincipalForAllLoans = 0;
        currentLoanData = [];

        const startForecastYear = currentYear;
        const endForecastYear   = currentYear + 5;
        const yearlyForecast    = {};
        let totalEmiCurrentYearRemainingForecast = 0;

        const rows = document.querySelectorAll('#bank-a-debts tr');
        rows.forEach(row => {
            const bankName   = row.children[0]?.textContent || '';
            const description = row.dataset.description || row.children[1]?.textContent || '';
            const emi        = parseFloat(row.dataset.emi) || 0;
            const tenureMonths = parseInt(row.dataset.tenure) || 0;
            const emiDay     = parseInt(row.dataset.emiDay) || 1;
            const endDay     = parseInt(row.dataset.endDay) || 28;
            const endMonth   = parseInt(row.dataset.endMonth) - 1;
            const endYear    = parseInt(row.dataset.endYear);
            const startDay   = parseInt(row.dataset.startDay) || 1;
            const startMonth = parseInt(row.dataset.startMonth) - 1;
            const startYear  = parseInt(row.dataset.startYear);
            const principalAmount     = parseFloat(row.dataset.initialAmount) || 0;
            const annualInterestRate  = parseFloat(row.dataset.interestRate) || 0;

            const loanStartDate = new Date(startYear, startMonth, startDay);
            const loanEndDate   = new Date(endYear, endMonth, endDay, 23, 59, 59);

            const endDateCell = row.querySelector('.end-date');
            if (endDateCell) endDateCell.textContent = formatDate(endYear, endMonth + 1, endDay);

            let monthsPassed = 0;
            if (today >= loanStartDate) {
                monthsPassed = (today.getFullYear() - loanStartDate.getFullYear()) * 12
                             + (today.getMonth() - loanStartDate.getMonth());
                if (currentDayOfMonth < emiDay &&
                    !(today.getFullYear() === loanStartDate.getFullYear() &&
                      today.getMonth()   === loanStartDate.getMonth())) {
                    monthsPassed--;
                }
            }
            monthsPassed = Math.min(monthsPassed, tenureMonths);

            let monthsRemaining = Math.max(0, tenureMonths - monthsPassed);
            let currentRemainingAmount = monthsRemaining * emi;

            if (today > loanEndDate) {
                monthsRemaining = 0;
                currentRemainingAmount = 0;
            }

            const totalPayableForLoan  = emi * tenureMonths;
            const totalInterestForLoan = Math.max(0, totalPayableForLoan - principalAmount);

            totalInterestForAllLoans  += totalInterestForLoan;
            totalPrincipalForAllLoans += principalAmount;

            const remainingAmountCell = row.querySelector('.remaining-amount');
            const remainingTenureCell = row.querySelector('.remaining-tenure');
            if (remainingAmountCell) remainingAmountCell.textContent = `₹ ${currentRemainingAmount.toLocaleString('en-IN')}`;
            if (remainingTenureCell) remainingTenureCell.textContent = `${monthsRemaining}`;

            // Yearly forecast
            for (let year = startForecastYear; year <= endForecastYear; year++) {
                const yearStart = new Date(year, 0, 1);
                const yearEnd   = new Date(year, 11, 31, 23, 59, 59);
                let paymentsInYear = 0;
                for (let i = 0; i < tenureMonths; i++) {
                    const payDate = new Date(startYear, startMonth + i, emiDay);
                    if (payDate >= yearStart && payDate <= yearEnd &&
                        payDate >= loanStartDate && payDate <= loanEndDate) {
                        paymentsInYear++;
                    }
                }
                yearlyForecast[year] = (yearlyForecast[year] || 0) + paymentsInYear * emi;
            }

            // Remaining current-year forecast
            const startOfToday   = new Date(currentYear, currentMonth, currentDayOfMonth);
            const endOfCurrentYear = new Date(currentYear, 11, 31, 23, 59, 59);
            let payRemaining = 0;
            for (let i = 0; i < tenureMonths; i++) {
                const payDate = new Date(startYear, startMonth + i, emiDay);
                if (payDate >= startOfToday && payDate <= endOfCurrentYear &&
                    payDate >= loanStartDate && payDate <= loanEndDate) {
                    payRemaining++;
                }
            }
            totalEmiCurrentYearRemainingForecast += payRemaining * emi;

            // Next EMI date
            let nextEmiDate = new Date(currentYear, currentMonth, emiDay);
            if (nextEmiDate < today) nextEmiDate.setMonth(nextEmiDate.getMonth() + 1);
            if (monthsRemaining === 0) nextEmiDate = null;
            const formattedNextEmiDate = nextEmiDate
                ? formatDate(nextEmiDate.getFullYear(), nextEmiDate.getMonth() + 1, nextEmiDate.getDate())
                : 'Completed';

            // Due countdown
            let dueCountdownText = '', dueCountdownClass = '';
            if (monthsRemaining <= 0) {
                dueCountdownText = 'Loan Completed!'; dueCountdownClass = 'completed';
            } else if (currentDayOfMonth === emiDay) {
                dueCountdownText = 'Due Today!'; dueCountdownClass = 'due-today';
            } else if (currentDayOfMonth < emiDay) {
                const daysLeft = emiDay - currentDayOfMonth;
                dueCountdownText = `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
                dueCountdownClass = 'due-future';
            } else {
                const daysPast = currentDayOfMonth - emiDay;
                dueCountdownText = `Paid ${daysPast} day${daysPast !== 1 ? 's' : ''} ago`;
                dueCountdownClass = 'paid';
            }

            currentLoanData.push({
                bankName, description, emi, monthsPassed, monthsRemaining,
                currentRemainingAmount, tenureMonths,
                progressPercentage: tenureMonths > 0
                    ? (monthsPassed / tenureMonths) * 100
                    : (monthsRemaining <= 0 ? 100 : 0),
                principalAmount, annualInterestRate,
                rowElement: row, nextEmiDate: formattedNextEmiDate, emiDay,
                loanEndDate, dueCountdown: dueCountdownText,
                dueCountdownClass,
                startDateFormatted: formatDate(startYear, startMonth + 1, startDay),
                endDateFormatted:   formatDate(endYear, endMonth + 1, endDay)
            });
        });

        return { yearlyForecast, totalEmiCurrentYearRemainingForecast };
    }

    // ============================================================
    // SUMMARY SECTION UPDATE
    // ============================================================
    function updateSummarySection() {
        let totalEmi = 0, totalRemainingAmount = 0, estimatedTotalInitialAmount = 0;
        let activeLoans = 0, totalActiveEmiAmount = 0, completedLoans = 0;
        const remainingByDescription = {};

        currentLoanData.forEach(loan => {
            totalEmi += loan.emi;
            if (loan.monthsRemaining > 0 && loan.currentRemainingAmount > 0) {
                activeLoans++;
                totalActiveEmiAmount += loan.emi;
            } else {
                completedLoans++;
            }
            totalRemainingAmount += loan.currentRemainingAmount;
            estimatedTotalInitialAmount += loan.emi * loan.tenureMonths;
            remainingByDescription[loan.description] =
                (remainingByDescription[loan.description] || 0) + loan.currentRemainingAmount;
        });

        const totalLoans = currentLoanData.length;
        if (totalLoansElement)       totalLoansElement.textContent       = totalLoans;
        if (completedLoansElement)   completedLoansElement.textContent   = completedLoans;
        if (activeLoansElement)      activeLoansElement.textContent      = activeLoans;
        if (totalActiveEmiElement)   totalActiveEmiElement.textContent   = `₹ ${totalActiveEmiAmount.toLocaleString('en-IN')}`;
        if (totalEmiElement)         totalEmiElement.textContent         = `₹ ${totalEmi.toLocaleString('en-IN')}`;
        if (totalRemainingElement)   totalRemainingElement.textContent   = `₹ ${totalRemainingAmount.toLocaleString('en-IN')}`;
        if (totalLoanAmountElement)  totalLoanAmountElement.textContent  = `₹ ${estimatedTotalInitialAmount.toLocaleString('en-IN')}`;
        if (totalInterestElement)    totalInterestElement.textContent    = `₹ ${totalInterestForAllLoans.toLocaleString('en-IN')}`;
        if (totalPrincipalElement)   totalPrincipalElement.textContent   = `₹ ${totalPrincipalForAllLoans.toLocaleString('en-IN')}`;

        if (summarySection) {
            summarySection.querySelectorAll('h3[data-description-summary]').forEach(el => el.remove());
            summarySection.querySelector('.desc-list-title')?.remove();
            const entries = Object.entries(remainingByDescription).filter(([, amt]) => amt > 0);
            entries
                .sort(([, a], [, b]) => b - a)
                .forEach(([desc, amt]) => {
                    const h3 = document.createElement('h3');
                    h3.setAttribute('data-description-summary', 'true');
                    h3.textContent = `${desc}: `;
                    const span = document.createElement('span');
                    span.className = 'remaining-by-desc';
                    span.textContent = `₹ ${amt.toLocaleString('en-IN')}`;
                    h3.appendChild(span);
                    summarySection.appendChild(h3);
                });
        }

        const freedomDate = getMaxEndDate();
        if (emiFreedomDateElement) {
            emiFreedomDateElement.textContent = (!freedomDate || freedomDate < new Date())
                ? '🎉 EMI Free!'
                : freedomDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
        }

        return { totalEmi, totalRemainingAmount, estimatedTotalInitialAmount };
    }

    // ============================================================
    // OVERALL PROGRESS BAR
    // ============================================================
    function updateOverallProgressSection(estimatedTotalInitialAmount, totalRemainingAmount) {
        if (!overallProgressBar || estimatedTotalInitialAmount <= 0) {
            if (overallProgressRaised) overallProgressRaised.textContent = '₹ 0 paid';
            if (overallProgressTotal)  overallProgressTotal.textContent  = '₹ 0 total';
            return;
        }
        const totalPaidAmount    = estimatedTotalInitialAmount - totalRemainingAmount;
        const progressPercentage = Math.min(100, (totalPaidAmount / estimatedTotalInitialAmount) * 100);
        const rounded = parseFloat(progressPercentage.toFixed(2));

        overallProgressBar.style.width = `${rounded}%`;
        if (overallProgressPercentage) overallProgressPercentage.textContent = `${rounded}%`;
        if (overallProgressRaised)     overallProgressRaised.textContent = `₹ ${totalPaidAmount.toLocaleString('en-IN')} paid`;
        if (overallProgressTotal)      overallProgressTotal.textContent  = `₹ ${estimatedTotalInitialAmount.toLocaleString('en-IN')} total`;

        // A11Y: update progressbar ARIA value
        const container = document.querySelector('.overall-progress-bar-container');
        container?.setAttribute('aria-valuenow', String(rounded));
    }

    // ============================================================
    // LOAN BOXES
    // ============================================================
    function renderLoanBoxes() {
        if (!loanBoxesContainer) return;
        loanBoxesContainer.innerHTML = '';
        [...currentLoanData]
            .sort((a, b) => b.progressPercentage - a.progressPercentage)
            .forEach((loan, index) => {
                const loanBox = document.createElement('div');
                loanBox.classList.add('loan-box');
                loanBox.setAttribute('data-loan-id', index);

                const totalPayable = loan.emi * loan.tenureMonths;
                const totalInterest = totalPayable - loan.principalAmount;
                const principalPercentage = (loan.principalAmount / totalPayable) * 100 || 0;
                const interestPercentage  = (totalInterest / totalPayable) * 100 || 0;
                const logoUrl = bankLogos[loan.bankName] || 'https://placehold.co/80x40/cccccc/000000?text=Bank';

                loanBox.innerHTML = `
                    <div class="card-header">
                        <h3 class="bank-name">${sanitize(loan.bankName)}</h3>
                        <img src="${sanitize(logoUrl)}" alt="${sanitize(loan.bankName)} logo" class="bank-logo" />
                    </div>
                    <p>${sanitize(loan.description)}</p>
                    <p>EMI: ₹${loan.emi.toLocaleString('en-IN', indianRupeeOptions)}</p>
                    <p>Interest Rate: ${loan.annualInterestRate}%</p>
                    <p>Total (Principal + Interest): ₹${totalPayable.toLocaleString('en-IN', indianRupeeOptions)}</p>
                    <div class="loan-breakdown-progress-container"
                         role="img" aria-label="Principal ${principalPercentage.toFixed(0)}% vs Interest ${interestPercentage.toFixed(0)}%">
                        <div class="principal-progress" style="width:${principalPercentage.toFixed(2)}%;">
                            <span class="progress-value">${principalPercentage.toFixed(0)}%</span>
                        </div>
                        <div class="interest-progress" style="width:${interestPercentage.toFixed(2)}%;">
                            <span class="progress-value">${interestPercentage.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div class="principal-interest-amounts">
                        <span class="principal-amount-display">Principal ₹${loan.principalAmount.toLocaleString('en-IN', indianRupeeOptions)}</span>
                        <span class="interest-amount-display">Interest ₹${totalInterest.toLocaleString('en-IN', indianRupeeOptions)}</span>
                    </div>
                    <p>Remaining Outstanding: ₹${loan.currentRemainingAmount.toLocaleString('en-IN', indianRupeeOptions)}</p>
                    <div class="loan-progress-bar-container"
                         role="progressbar"
                         aria-valuenow="${loan.progressPercentage.toFixed(0)}"
                         aria-valuemin="0" aria-valuemax="100"
                         aria-label="${sanitize(loan.bankName)} ${sanitize(loan.description)} repayment progress">
                        <div class="loan-progress-bar" style="width:${loan.progressPercentage}%;">
                            <span class="loan-progress-text">${loan.progressPercentage.toFixed(2)}%</span>
                        </div>
                    </div>
                    <p class="remaining-tenure-display">${loan.monthsRemaining > 0 ? `${loan.monthsRemaining} months left (Total: ${loan.tenureMonths})` : 'Completed'}</p>
                    <p class="next-emi-date">Next EMI: <span>${sanitize(loan.nextEmiDate)}</span></p>`;

                const forecloseButton = document.createElement('button');
                forecloseButton.classList.add('foreclose-button');
                forecloseButton.type = 'button';
                if (loan.monthsRemaining === 0) {
                    forecloseButton.textContent = 'Completed';
                    forecloseButton.disabled = true;
                    forecloseButton.classList.add('disabled-button');
                } else {
                    forecloseButton.textContent = 'Foreclose Calculator';
                    forecloseButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openForeclosureCalculator(loan);
                    });
                }

                loanBox.appendChild(forecloseButton);
                loanBoxesContainer.appendChild(loanBox);
            });
    }

    // ============================================================
    // EMI FORECAST SECTION
    // ============================================================
    function buildForecastHTML(container, yearlyForecast, totalEmiCurrentYearRemainingForecast) {
        if (!container) return;
        const today = new Date();
        const currentYear = today.getFullYear();
        container.innerHTML = '';

        const title = document.createElement('h2');
        title.textContent = 'Yearly EMI Forecast';
        container.appendChild(title);

        Object.entries(yearlyForecast).forEach(([year, amount]) => {
            const yearInt = parseInt(year);
            const item = document.createElement('div');
            item.classList.add('yearly-forecast-item');

            let label = `${year} (Future)`;
            if (yearInt < currentYear)      { label = `${year} (Past)`;    item.classList.add('past-year'); }
            else if (yearInt === currentYear){ label = `${year} (Current)`; item.classList.add('current-year'); }

            const h3 = document.createElement('h3');
            h3.textContent = label;

            const rightCol = document.createElement('div');
            rightCol.style.textAlign = 'right';

            const p = document.createElement('p');
            p.textContent = `₹ ${amount.toLocaleString('en-IN')}`;

            rightCol.appendChild(p);

            if (yearInt === currentYear && totalEmiCurrentYearRemainingForecast > 0) {
                const info = document.createElement('div');
                info.classList.add('additional-info');
                info.style.display = 'block';
                info.style.marginTop = '2px';
                info.textContent = `Remaining: ₹ ${totalEmiCurrentYearRemainingForecast.toLocaleString('en-IN')}`;
                rightCol.appendChild(info);
            }

            item.appendChild(h3);
            item.appendChild(rightCol);
            container.appendChild(item);
        });
    }

    function updateEmiForecastSection(yearlyForecast, totalEmiCurrentYearRemainingForecast) {
        buildForecastHTML(emiForecastSection, yearlyForecast, totalEmiCurrentYearRemainingForecast);
        buildForecastHTML(sidebarForecastPanel, yearlyForecast, totalEmiCurrentYearRemainingForecast);
    }

    // ============================================================
    // CHARTS
    // ============================================================
    function updateCharts() {
        // Doughnut chart
        if (loanBreakdownChartCanvas) {
            const ctx = loanBreakdownChartCanvas.getContext('2d');
            if (window.loanBreakdownChartInstance) window.loanBreakdownChartInstance.destroy();
            window.loanBreakdownChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Principal', 'Interest'],
                    datasets: [{
                        data: [totalPrincipalForAllLoans, totalInterestForAllLoans],
                        backgroundColor: ['#3b82f6', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => `₹ ${ctx.raw.toLocaleString('en-IN')}` } }
                    }
                }
            });
        }

    }

    // ============================================================
    // TOP LOANS LIST
    // ============================================================
    function updateTopLoansList() {
        const sortedLoans = [...currentLoanData]
            .filter(l => l.monthsRemaining > 0 && l.currentRemainingAmount > 0)
            .sort((a, b) => a.monthsRemaining - b.monthsRemaining)
            .slice(0, topLoansCount);

        if (!topLoansList) return;
        topLoansList.innerHTML = '';
        sortedLoans.forEach((loan, idx) => {
            const item = document.createElement('li');
            item.classList.add('top-loan-item');
            item.style.fontFamily = "'Space Grotesk', system-ui, -apple-system, sans-serif";
            const remaining = (100 - loan.progressPercentage).toFixed(1);
            const almostDone = loan.progressPercentage >= 90;
            item.innerHTML = `
                <div class="tl-top">
                    <span class="tl-rank">${idx + 1}</span>
                    <span class="tl-bank">${sanitize(loan.bankName)}</span>
                    <span class="tl-months-badge">${loan.monthsRemaining} ${loan.monthsRemaining === 1 ? 'month' : 'months'} left</span>
                </div>
                <div class="tl-stats">
                    <div class="tl-stat">
                        <div class="tl-stat-label">EMI</div>
                        <div class="tl-stat-val tl-accent">₹${loan.emi.toLocaleString('en-IN')}</div>
                    </div>
                    <div class="tl-stat">
                        <div class="tl-stat-label">Outstanding</div>
                        <div class="tl-stat-val">₹${loan.currentRemainingAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div class="tl-stat">
                        <div class="tl-stat-label">Paid</div>
                        <div class="tl-stat-val">${loan.progressPercentage.toFixed(1)}%</div>
                    </div>
                </div>
                <div class="tl-bar-wrap">
                    <div class="tl-bar-fill${almostDone ? ' tl-bar-done' : ''}" style="width:${loan.progressPercentage}%;"></div>
                </div>
                <div class="tl-bar-meta">
                    <span>${remaining}% remaining</span>
                    ${almostDone ? '<span class="tl-done-label">Almost done!</span>' : ''}
                </div>`;
            topLoansList.appendChild(item);
        });
    }

    // ============================================================
    // DEBT BY BANK
    // ============================================================
    function updateDebtByBankSection() {
        if (!debtByBankList) return;
        const debtByBank = {};
        currentLoanData.forEach(loan => {
            debtByBank[loan.bankName] = (debtByBank[loan.bankName] || 0) + loan.currentRemainingAmount;
        });
        const totalDebt = Object.values(debtByBank).reduce((s, a) => s + a, 0);
        const sorted = Object.entries(debtByBank)
            .filter(([, amount]) => amount > 0)
            .sort(([,a],[,b]) => b - a);

        debtByBankList.innerHTML = '';
        sorted.forEach(([bank, amount]) => {
            const percent = totalDebt > 0 ? ((amount / totalDebt) * 100).toFixed(1) : 0;
            const row = document.createElement('div');
            row.className = 'bank-debt-row';
            row.innerHTML = `
                <img src="${sanitize(bankLogos[bank] || 'bank.png')}" class="bank-debt-logo" alt="${sanitize(bank)} logo" />
                <div class="bank-debt-info">
                    <div class="bank-debt-name">${sanitize(bank)}</div>
                    <div class="bank-debt-bar">
                        <div class="bank-debt-fill" style="width:${percent}%"></div>
                    </div>
                </div>
                <div class="bank-debt-amount">₹ ${amount.toLocaleString('en-IN')}</div>`;
            debtByBankList.appendChild(row);
        });
    }

    // ============================================================
    // TABLE ROW COLOURING
    // ============================================================
    function updateTableLoanRowColors() {
        const currentDayOfMonth = new Date().getDate();
        currentLoanData.forEach(loan => {
            const row = loan.rowElement;
            if (!row) return;
            row.classList.remove('today-emi', 'future-emi', 'past-emi');
            if (loan.monthsRemaining <= 0) { row.remove(); return; }
            if (currentDayOfMonth === loan.emiDay)      row.classList.add('today-emi');
            else if (currentDayOfMonth < loan.emiDay)   row.classList.add('future-emi');
            else                                         row.classList.add('past-emi');
        });
    }

    // ============================================================
    // TABLE SORTING
    // ============================================================
    function setupTableSorting() {
        let currentSortedColumn = null;
        let sortAscending = true;

        document.querySelectorAll('.sortable').forEach(header => {
            header.dataset.originalText = header.textContent.trim();
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                const rows = Array.from(document.querySelectorAll('#bank-a-debts tr'));

                rows.sort((a, b) => {
                    const getValue = (row) => {
                        switch (column) {
                            case 'bank':        return row.children[0].textContent.toLowerCase();
                            case 'description': return row.children[1].textContent.toLowerCase();
                            case 'end':         return new Date(
                                parseInt(row.dataset.endYear),
                                parseInt(row.dataset.endMonth) - 1,
                                parseInt(row.dataset.endDay) || 5
                            );
                            case 'emi':         return parseFloat(row.children[3].textContent.replace(/[^\d.-]/g, ''));
                            case 'remaining':   return parseFloat(row.children[4].textContent.replace(/[^\d.-]/g, ''));
                            case 'tenure':      return parseInt(row.children[5].textContent);
                            default:            return '';
                        }
                    };
                    const aVal = getValue(a), bVal = getValue(b);
                    if (typeof aVal === 'string') return sortAscending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                    return sortAscending ? aVal - bVal : bVal - aVal;
                });

                if (currentSortedColumn === column) sortAscending = !sortAscending;
                else { sortAscending = true; currentSortedColumn = column; }

                const tbody = document.getElementById('bank-a-debts');
                tbody.innerHTML = '';
                rows.forEach(row => tbody.appendChild(row));

                // BUG FIX: Update aria-sort on all headers
                document.querySelectorAll('.sortable').forEach(h => {
                    h.textContent = h.dataset.originalText;
                    h.setAttribute('aria-sort', 'none');
                });
                header.textContent = header.dataset.originalText + (sortAscending ? ' ↑' : ' ↓');
                header.setAttribute('aria-sort', sortAscending ? 'ascending' : 'descending');
            });
        });
    }

    // ============================================================
    // DASHBOARD ORCHESTRATOR
    // BUG FIX: Removed duplicate totals-accumulation loop that
    // existed separately from updateSummarySection.
    // ============================================================
    function updateDashboard() {
        const { yearlyForecast, totalEmiCurrentYearRemainingForecast } = calculateAllLoanMetrics();
        const { totalRemainingAmount, estimatedTotalInitialAmount } = updateSummarySection();
        updateOverallProgressSection(estimatedTotalInitialAmount, totalRemainingAmount);
        renderLoanBoxes();
        updateEmiForecastSection(yearlyForecast, totalEmiCurrentYearRemainingForecast);
        updateCharts();
        updateTopLoansList();
        updateDebtByBankSection();
        updateTableLoanRowColors();
        // BATTERY FIX 1: refresh cached end date whenever loan data changes
        refreshCachedEndDate();
        updateOverallCountdown();
    }

    // ============================================================
    // LOAN DATABASE MANAGEMENT
    // ============================================================
    let loansDatabase = [];

    function initializeDatabase() {
        // BUG FIX: Original code called localStorage.getItem() then redundantly
        // called safeLocalStorageGet() again. Now just one safe read.
        const existing = safeLocalStorageGet('loansDatabase', null);
        if (existing && Array.isArray(existing) && existing.length > 0) {
            loansDatabase = existing;
            renderLoansFromDatabase();
        } else {
            loadHardcodedLoans();
        }
    }

    const DEFAULT_LOANS = [
        { bankName:"IDFC BANK",     description:"Credit card loan", initialAmount:10000,  emi:1186,  interestRate:16,    tenure:9,  startDay:19, startMonth:12, startYear:2024, emiDay:19, endDay:19, endMonth:9,  endYear:2025 },
        { bankName:"SBI BANK",      description:"Flexipay",         initialAmount:40911,  emi:2017,  interestRate:16.8,  tenure:24, startDay:11, startMonth:10, startYear:2023, emiDay:11, endDay:11, endMonth:9,  endYear:2025 },
        { bankName:"SBI BANK",      description:"Laptop",           initialAmount:52451,  emi:3284,  interestRate:16,    tenure:18, startDay:11, startMonth:8,  startYear:2024, emiDay:11, endDay:11, endMonth:2,  endYear:2026 },
        { bankName:"ICICI BANK",    description:"Credit card loan", initialAmount:35000,  emi:1713,  interestRate:16,    tenure:24, startDay:28, startMonth:2,  startYear:2024, emiDay:28, endDay:28, endMonth:2,  endYear:2026 },
        { bankName:"KOTAK BANK",    description:"Personal loan",    initialAmount:60000,  emi:3915,  interestRate:21,    tenure:18, startDay:2,  startMonth:10, startYear:2024, emiDay:2,  endDay:2,  endMonth:4,  endYear:2026 },
        { bankName:"DMI FINANCE",   description:"Personal loan",    initialAmount:300000, emi:11457, interestRate:21,    tenure:36, startDay:5,  startMonth:5,  startYear:2023, emiDay:5,  endDay:5,  endMonth:5,  endYear:2026 },
        { bankName:"ICICI BANK",    description:"Credit card loan", initialAmount:35000,  emi:1713,  interestRate:16,    tenure:24, startDay:28, startMonth:5,  startYear:2024, emiDay:28, endDay:28, endMonth:5,  endYear:2026 },
        { bankName:"SBI BANK",      description:"Encash",           initialAmount:200000, emi:7031,  interestRate:16,    tenure:36, startDay:11, startMonth:6,  startYear:2023, emiDay:11, endDay:11, endMonth:6,  endYear:2026 },
        { bankName:"AXIS BANK",     description:"Credit card loan", initialAmount:30000,  emi:1953,  interestRate:18,    tenure:18, startDay:13, startMonth:12, startYear:2024, emiDay:13, endDay:13, endMonth:6,  endYear:2026 },
        { bankName:"IDFC BANK",     description:"Two wheeler loan", initialAmount:42821,  emi:3885,  interestRate:16,    tenure:12, startDay:24, startMonth:6,  startYear:2025, emiDay:24, endDay:24, endMonth:6,  endYear:2026 },
        { bankName:"SBI BANK",      description:"Flexipay",         initialAmount:43010,  emi:1533,  interestRate:17.02, tenure:36, startDay:11, startMonth:7,  startYear:2023, emiDay:11, endDay:11, endMonth:7,  endYear:2026 },
        { bankName:"RBL BANK",      description:"Personal loan",    initialAmount:174000, emi:8941,  interestRate:21,    tenure:24, startDay:12, startMonth:8,  startYear:2024, emiDay:12, endDay:12, endMonth:8,  endYear:2026 },
        { bankName:"KOTAK BANK",    description:"Kjc fees",         initialAmount:33584,  emi:1692,  interestRate:19,    tenure:24, startDay:25, startMonth:8,  startYear:2024, emiDay:25, endDay:25, endMonth:8,  endYear:2026 },
        { bankName:"SBI BANK",      description:"Fridge",           initialAmount:18530,  emi:1677,  interestRate:15.5,  tenure:12, startDay:11, startMonth:9,  startYear:2025, emiDay:11, endDay:11, endMonth:9,  endYear:2026 },
        { bankName:"KOTAK BANK",    description:"Kjc fees",         initialAmount:83451,  emi:3058,  interestRate:19,    tenure:36, startDay:25, startMonth:1,  startYear:2024, emiDay:25, endDay:25, endMonth:2,  endYear:2027 },
        { bankName:"SBI BANK",      description:"Jimcy",            initialAmount:40000,  emi:3203,  interestRate:16,    tenure:18, startDay:26, startMonth:11, startYear:2025, emiDay:26, endDay:26, endMonth:4,  endYear:2027 },
        { bankName:"IDFC BANK",     description:"Jimcy",            initialAmount:40000,  emi:2155,  interestRate:16,    tenure:24, startDay:24, startMonth:7,  startYear:2025, emiDay:23, endDay:23, endMonth:6,  endYear:2027 },
        { bankName:"CREDIT SAISON", description:"Personal loan",    initialAmount:250000, emi:9037,  interestRate:18,    tenure:36, startDay:19, startMonth:8,  startYear:2025, emiDay:3,  endDay:3,  endMonth:7,  endYear:2028 },
        { bankName:"INDUSIND BANK", description:"Credit card loan", initialAmount:40000,  emi:1406,  interestRate:16,    tenure:36, startDay:15, startMonth:7,  startYear:2025, emiDay:15, endDay:15, endMonth:7,  endYear:2028 },
        { bankName:"INDUSIND BANK", description:"Personal loan",    initialAmount:200000, emi:5823,  interestRate:17.5,  tenure:48, startDay:4,  startMonth:1,  startYear:2025, emiDay:4,  endDay:4,  endMonth:2,  endYear:2029 },
        { bankName:"AXIS BANK",     description:"Personal loan",    initialAmount:196000, emi:4560,  interestRate:14,    tenure:60, startDay:5,  startMonth:3,  startYear:2025, emiDay:5,  endDay:5,  endMonth:2,  endYear:2030 }
    ];

    function loadHardcodedLoans() {
        loansDatabase = DEFAULT_LOANS.map(loan => ({
            ...loan,
            // SECURITY FIX: crypto.randomUUID() instead of Date.now()+Math.random()
            id: (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`
        }));
        saveToLocalStorage();
    }

    function saveToLocalStorage() {
        localStorage.setItem('loansDatabase', JSON.stringify(loansDatabase));
    }

    function renderLoansFromDatabase() {
        const tbody = document.getElementById('bank-a-debts');
        tbody.innerHTML = '';
        loansDatabase.forEach(loan => {
            const row = document.createElement('tr');
            Object.assign(row.dataset, {
                initialAmount: loan.initialAmount,
                emi:           loan.emi,
                endDay:        loan.endDay,
                emiDay:        loan.emiDay,
                endMonth:      loan.endMonth,
                endYear:       loan.endYear,
                tenure:        loan.tenure,
                startMonth:    loan.startMonth,
                startYear:     loan.startYear,
                startDay:      loan.startDay,
                interestRate:  loan.interestRate,
                description:   loan.description
            });
            row.innerHTML = `
                <td>${sanitize(loan.bankName)}</td>
                <td>${sanitize(loan.description)}</td>
                <td class="end-date"></td>
                <td>₹ ${loan.emi.toLocaleString('en-IN')}</td>
                <td class="remaining-amount"></td>
                <td class="remaining-tenure"></td>`;
            tbody.appendChild(row);
        });
    }

    // Admin panel open/close
    function openAdminPanel() {
        const modal = document.getElementById('adminModal');
        if (modal) { modal.hidden = false; refreshAdminLoansList(); }
    }

    function closeAdminPanel() {
        const modal = document.getElementById('adminModal');
        if (modal) { modal.hidden = true; resetForm(); }
    }

    function resetForm() {
        document.getElementById('loanForm')?.reset();
        const loanId   = document.getElementById('loanId');
        const editMode = document.getElementById('editMode');
        if (loanId)   loanId.value   = '';
        if (editMode) editMode.value = 'false';
    }

    // Wire cancel button (was inline onclick in HTML)
    document.getElementById('cancelLoanBtn')?.addEventListener('click', resetForm);

    function refreshAdminLoansList() {
        const tbody = document.getElementById('adminLoansTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        loansDatabase.forEach((loan, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sanitize(loan.bankName)}</td>
                <td>${sanitize(loan.description)}</td>
                <td>₹ ${loan.initialAmount.toLocaleString('en-IN')}</td>
                <td>₹ ${loan.emi.toLocaleString('en-IN')}</td>
                <td>
                    <button type="button" class="btn-edit" data-idx="${index}" aria-label="Edit ${sanitize(loan.bankName)} loan">
                        <i class="fas fa-edit" aria-hidden="true"></i>
                    </button>
                    <button type="button" class="btn-delete" data-idx="${index}" aria-label="Delete ${sanitize(loan.bankName)} loan">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                    </button>
                </td>`;
            tbody.appendChild(row);
        });

        // SECURITY FIX: event delegation instead of inline onclick="editLoan()"
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editLoan(parseInt(btn.dataset.idx)));
        });
        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteLoan(parseInt(btn.dataset.idx)));
        });
    }

    // Loan form submission
    const loanForm = document.getElementById('loanForm');
    if (loanForm) {
        loanForm.addEventListener('submit', function (e) {
            e.preventDefault();
            loanForm.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));

            let hasError = false;
            const fields = ['bankName','description','initialAmount','emi','interestRate','tenure','startDay','startMonth','startYear','emiDay'];
            fields.forEach(id => {
                const input = document.getElementById(id);
                if (!input || input.value.trim() === '') {
                    if (input) input.classList.add('invalid');
                    hasError = true;
                }
            });

            if (hasError) { showToast('Please fill in all required fields.', 'error'); return; }

            const initialAmt   = parseFloat(document.getElementById('initialAmount').value);
            const emiAmt       = parseFloat(document.getElementById('emi').value);
            const tenure       = parseInt(document.getElementById('tenure').value);
            const interestRate = parseFloat(document.getElementById('interestRate').value);
            const startDay     = parseInt(document.getElementById('startDay').value);
            const startMonth   = parseInt(document.getElementById('startMonth').value);
            const startYear    = parseInt(document.getElementById('startYear').value);
            const emiDay       = parseInt(document.getElementById('emiDay').value);

            if (initialAmt <= 0)                              { showToast('Initial amount must be > 0.', 'error'); return; }
            if (emiAmt <= 0)                                  { showToast('EMI amount must be > 0.', 'error'); return; }
            if (tenure <= 0)                                  { showToast('Tenure must be ≥ 1 month.', 'error'); return; }
            if (interestRate < 0 || interestRate > 100)       { showToast('Interest rate must be 0–100.', 'error'); return; }
            if (startDay < 1 || startDay > 31)                { showToast('Start day must be 1–31.', 'error'); return; }
            if (startMonth < 1 || startMonth > 12)            { showToast('Start month must be 1–12.', 'error'); return; }
            if (startYear < 2000 || startYear > 2100)         { showToast('Start year must be 2000–2100.', 'error'); return; }
            if (emiDay < 1 || emiDay > 31)                    { showToast('EMI day must be 1–31.', 'error'); return; }
            if (emiAmt * tenure < initialAmt)                  showToast('Warning: Total EMIs less than initial amount. Please verify.', 'warning', 5000);

            // BUG FIX: endMonth calculation. Original formula:
            //   (startMonth + tenure - 1) % 12 || 12
            // When result is exactly 0 (i.e. divisible by 12), `|| 12` correctly
            // returns 12, but endYear calculation was off by one.
            // Fixed by computing proper date arithmetic.
            const endDateObj = new Date(startYear, startMonth - 1 + tenure, 1);
            // tenure months after start → but EMI day is the emiDay of that month
            const endMonth = endDateObj.getMonth() === 0 ? 12 : endDateObj.getMonth();
            const endYear  = endDateObj.getMonth() === 0
                ? endDateObj.getFullYear() - 1
                : endDateObj.getFullYear();

            const loanData = {
                id: document.getElementById('loanId').value || (
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `${Date.now()}-${Math.random()}`
                ),
                bankName:      document.getElementById('bankName').value.trim(),
                description:   document.getElementById('description').value.trim(),
                initialAmount: initialAmt,
                emi:           emiAmt,
                interestRate:  interestRate,
                tenure:        tenure,
                startDay:      startDay,
                startMonth:    startMonth,
                startYear:     startYear,
                emiDay:        emiDay,
                endDay:        emiDay,
                endMonth:      endMonth,
                endYear:       endYear
            };

            const editMode = document.getElementById('editMode').value === 'true';
            if (editMode) {
                const idx = loansDatabase.findIndex(l => String(l.id) === String(loanData.id));
                if (idx !== -1) loansDatabase[idx] = loanData;
            } else {
                loansDatabase.push(loanData);
            }

            saveToLocalStorage();
            renderLoansFromDatabase();
            refreshAdminLoansList();
            updateDashboard();
            runNewFeatures();
            resetForm();
            showToast(editMode ? 'Loan updated.' : 'Loan added.', 'success');
        });
    }

    function editLoan(index) {
        const loan = loansDatabase[index];
        if (!loan) return;
        [['loanId',       loan.id],
         ['bankName',     loan.bankName],
         ['description',  loan.description],
         ['initialAmount',loan.initialAmount],
         ['emi',          loan.emi],
         ['interestRate', loan.interestRate],
         ['tenure',       loan.tenure],
         ['startDay',     loan.startDay],
         ['startMonth',   loan.startMonth],
         ['startYear',    loan.startYear],
         ['emiDay',       loan.emiDay],
         ['editMode',     'true']
        ].forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        });
    }

    function deleteLoan(index) {
        showConfirm('Are you sure you want to delete this loan? This cannot be undone.', () => {
            loansDatabase.splice(index, 1);
            saveToLocalStorage();
            renderLoansFromDatabase();
            refreshAdminLoansList();
            updateDashboard();
            runNewFeatures();
            showToast('Loan deleted.', 'warning');
        });
    }

    // Export / Import — wired from HTML buttons (no inline onclick)
    document.getElementById('exportLoansBtn')?.addEventListener('click', () => {
        const dataStr = JSON.stringify(loansDatabase, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = `loans_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    });

    document.getElementById('importLoansBtn')?.addEventListener('click', () => {
        document.getElementById('importFile')?.click();
    });

    document.getElementById('importFile')?.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // SECURITY FIX: validate MIME type before reading
        if (file.type && file.type !== 'application/json' && !file.name.endsWith('.json')) {
            showToast('Invalid file type — only .json files are accepted.', 'error');
            this.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (ev) {
            try {
                const importedLoans = JSON.parse(ev.target.result);
                if (!Array.isArray(importedLoans)) {
                    showToast('Invalid format — expected a JSON array.', 'error');
                    return;
                }
                const validLoans = importedLoans.filter(isValidLoan);
                const skipped = importedLoans.length - validLoans.length;
                if (validLoans.length === 0) { showToast('No valid loans found in file.', 'error'); return; }
                loansDatabase = validLoans;
                saveToLocalStorage();
                renderLoansFromDatabase();
                refreshAdminLoansList();
                updateDashboard();
                runNewFeatures();
                // SECURITY FIX: Don't expose error.message directly in toasts
                const msg = skipped > 0
                    ? `Imported ${validLoans.length} loans (${skipped} invalid entries skipped).`
                    : `Imported ${validLoans.length} loans successfully.`;
                showToast(msg, skipped > 0 ? 'warning' : 'success');
            } catch {
                // SECURITY FIX: generic message, no raw error.message exposed
                showToast('Could not parse file. Please check it is a valid loans JSON.', 'error');
            }
        };
        reader.readAsText(file);
    });

    // Admin panel wiring
    document.getElementById('adminToggleBtn')?.addEventListener('click', openAdminPanel);
    document.getElementById('tabAdmin')?.addEventListener('click', openAdminPanel);
    document.getElementById('deskTabAdmin')?.addEventListener('click', openAdminPanel);

    document.querySelectorAll('.close-admin').forEach(btn => {
        btn.addEventListener('click', function () {
            const modal = this.closest('.modal');
            if (modal) { modal.hidden = true; }
            if (modal?.id === 'adminModal') resetForm();
        });
    });

    window.addEventListener('click', e => {
        const adminModal = document.getElementById('adminModal');
        if (e.target === adminModal) closeAdminPanel();
        const reminderModal = document.getElementById('reminderModal');
        if (e.target === reminderModal) reminderModal.hidden = true;
        const foreclosureModal = document.getElementById('foreclosureModal');
        if (e.target === foreclosureModal) foreclosureModal.hidden = true;
    });

    // ============================================================
    // FEATURE 1: INTEREST RATE COMPARISON
    // ============================================================
    function renderInterestRateComparison() {
        const container = document.getElementById('interest-rate-list');
        const tipEl     = document.getElementById('attack-order-tip');
        if (!container) return;

        const activeLoans = currentLoanData.filter(l => l.monthsRemaining > 0);
        if (!activeLoans.length) {
            container.innerHTML = '<p style="color:#64748b;font-size:0.85em;">No active loans.</p>';
            return;
        }

        const loansWithPct = activeLoans.map(loan => {
            const totalPayable  = loan.emi * loan.tenureMonths;
            const totalInterest = Math.max(0, totalPayable - loan.principalAmount);
            const interestPct   = totalPayable > 0 ? (totalInterest / totalPayable) * 100 : 0;
            return { loan, totalPayable, totalInterest, interestPct };
        }).sort((a, b) => b.interestPct - a.interestPct);

        container.innerHTML = '';
        loansWithPct.forEach(({ loan, interestPct }, i) => {
            const colorClass = interestPct >= 20 ? 'rate-high' : interestPct >= 12 ? 'rate-medium' : 'rate-low';
            const row = document.createElement('div');
            row.className = 'rate-row';
            row.innerHTML = `
                <div class="rate-row-header">
                    <span class="rate-rank">#${i + 1}</span>
                    <span class="rate-bank">${sanitize(loan.bankName)}</span>
                    <span class="rate-desc">${sanitize(loan.description)}</span>
                    <span class="rate-badge ${colorClass}">${interestPct.toFixed(1)}%</span>
                </div>
                <div class="rate-meta">
                    <span>EMI ₹${loan.emi.toLocaleString('en-IN')} · ${loan.monthsRemaining}m left</span>
                    <span>Outstanding ₹${loan.currentRemainingAmount.toLocaleString('en-IN')}</span>
                </div>`;
            container.appendChild(row);
        });

        if (tipEl) tipEl.hidden = true;
    }

    // ============================================================
    // FEATURE 2: EMI REMINDERS (Web Notifications API)
    // ============================================================
    function getReminderDays() { return parseInt(localStorage.getItem('reminderDays') || '3'); }
    function getReminderTime() { return localStorage.getItem('reminderTime') || '09:00'; }

    function getUpcomingEmiReminders(daysAhead) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = [];
        currentLoanData.forEach(loan => {
            if (loan.monthsRemaining <= 0) return;
            [
                new Date(today.getFullYear(), today.getMonth(), loan.emiDay),
                new Date(today.getFullYear(), today.getMonth() + 1, loan.emiDay)
            ].forEach(dueDate => {
                const diff = Math.ceil((dueDate - today) / 86400000);
                if (diff >= 0 && diff <= daysAhead) upcoming.push({ loan, dueDate, daysLeft: diff });
            });
        });
        return upcoming.sort((a, b) => a.daysLeft - b.daysLeft);
    }

    function updateReminderBadge() {
        const badge = document.getElementById('reminderBadge');
        if (!badge) return;
        const count = getUpcomingEmiReminders(getReminderDays()).length;
        // BUG FIX: Use hidden attribute consistent with CSS [hidden] rule
        if (count > 0) {
            badge.textContent = count;
            badge.hidden = false;
        } else {
            badge.hidden = true;
        }
    }

    /**
     * BUG FIX: buildNotificationContent() extracted to eliminate the duplicated
     * if/else title/body block that appeared twice in fireNotificationsIfDue().
     */
    function buildNotificationContent(loan, daysLeft) {
        const emiAmt   = `₹${loan.emi.toLocaleString('en-IN')}`;
        const label    = `${loan.bankName} ${loan.description}`;
        const dueDate  = new Date();
        dueDate.setDate(dueDate.getDate() + daysLeft);
        const dueDateStr = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

        if (daysLeft === 0) {
            return { title: `⚠️ EMI Alert: ${emiAmt} for ${label}`, body: `Your EMI is due TODAY!` };
        } else if (daysLeft === 1) {
            return { title: `⚠️ EMI Alert: ${emiAmt} for ${label}`, body: `EMI is due tomorrow.` };
        } else {
            return { title: `🔔 EMI Reminder: ${emiAmt} for ${label}`, body: `Due in ${daysLeft} days (${dueDateStr}).` };
        }
    }

    function fireNotificationsIfDue() {
        if (Notification.permission !== 'granted') return;
        const days    = getReminderDays();
        const upcoming = getUpcomingEmiReminders(days);
        const fired   = safeLocalStorageGet('firedNotifs', {});
        const todayKey = new Date().toISOString().slice(0, 10);
        if (!fired[todayKey]) fired[todayKey] = [];

        const [rh, rm] = getReminderTime().split(':').map(Number);
        const now = new Date();
        const scheduledToday = new Date();
        scheduledToday.setHours(rh, rm, 0, 0);

        upcoming.forEach(({ loan, daysLeft }) => {
            const key = `${loan.bankName}-${loan.description}-${daysLeft}`;
            if (fired[todayKey].includes(key)) return;
            const { title, body } = buildNotificationContent(loan, daysLeft);
            const icon = getBankIcon(loan.bankName);

            if (now < scheduledToday) {
                const delay = scheduledToday - now;
                setTimeout(() => {
                    if (Notification.permission === 'granted') new Notification(title, { body, icon });
                }, delay);
            } else {
                new Notification(title, { body, icon });
            }
            fired[todayKey].push(key);
        });

        // Prune old keys
        Object.keys(fired).forEach(k => { if (k < todayKey) delete fired[k]; });
        localStorage.setItem('firedNotifs', JSON.stringify(fired));
    }

    function renderReminderModal() {
        const statusEl  = document.getElementById('notifPermStatus');
        const slider    = document.getElementById('reminderDaysSlider');
        const timeInput = document.getElementById('reminderTime');

        if (statusEl) {
            const perm = Notification.permission;
            // SECURITY FIX: use textContent, not innerHTML for permission status
            statusEl.textContent = perm === 'granted' ? '✅ Enabled' : perm === 'denied' ? '❌ Blocked' : '⚠️ Not set';
        }

        const days = getReminderDays();
        if (slider)    slider.value = days;
        const label = document.getElementById('reminderDaysLabel');
        if (label)     label.textContent = days;
        if (timeInput) timeInput.value = getReminderTime();

        const listEl = document.getElementById('upcoming-reminders-list');
        if (!listEl) return;
        const upcoming = getUpcomingEmiReminders(days);
        listEl.innerHTML = '';

        if (!upcoming.length) {
            const p = document.createElement('p');
            p.className = 'rmd-empty';
            p.textContent = `No EMIs due within the next ${days} day${days > 1 ? 's' : ''}.`;
            listEl.appendChild(p);
            return;
        }

        const header = document.createElement('p');
        header.style.cssText = 'font-size:0.78em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;';
        header.textContent = `Within next ${days} day${days > 1 ? 's' : ''}`;
        listEl.appendChild(header);

        upcoming.forEach(({ loan, daysLeft }) => {
            const urgencyClass = daysLeft === 0 ? 'reminder-today' : daysLeft <= 2 ? 'reminder-soon' : 'reminder-upcoming';
            const urgencyText  = daysLeft === 0 ? 'TODAY' : `in ${daysLeft}d`;
            const item = document.createElement('div');
            item.className = `reminder-item ${urgencyClass}`;
            item.innerHTML = `
                <div class="reminder-item-left">
                    <span class="reminder-urgency">${sanitize(urgencyText)}</span>
                    <span class="reminder-bank">${sanitize(loan.bankName)}</span>
                    <span class="reminder-desc">${sanitize(loan.description)}</span>
                </div>
                <span class="reminder-amt">₹${loan.emi.toLocaleString('en-IN')}</span>`;
            listEl.appendChild(item);
        });
    }

    // Reminder modal wiring
    const bellBtn       = document.getElementById('reminderBellBtn');
    const reminderModal = document.getElementById('reminderModal');

    bellBtn?.addEventListener('click', () => {
        renderReminderModal();
        reminderModal.hidden = false;

        const ti      = document.getElementById('reminderTime');
        const saveBtn = document.getElementById('saveReminderTimeBtn');
        if (ti && saveBtn && !saveBtn._listenerAttached) {
            saveBtn._listenerAttached = true;
            saveBtn.addEventListener('click', () => {
                if (!ti.value) return;
                localStorage.setItem('reminderTime', ti.value);
                showToast(`Reminder time set to ${ti.value}`, 'success');
                saveBtn.classList.add('saved');
                saveBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Saved!';
                setTimeout(() => {
                    saveBtn.classList.remove('saved');
                    saveBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Set';
                }, 1500);
            });
        }
    });

    document.getElementById('closeReminderModal')?.addEventListener('click', () => {
        if (reminderModal) reminderModal.hidden = true;
    });

    // Tab switching in reminder modal
    document.querySelectorAll('.rmd-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.rmd-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            document.querySelectorAll('.rmd-tab-panel').forEach(p => { p.hidden = true; });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const target = document.getElementById('rmdTab-' + tab.dataset.tab);
            if (target) target.hidden = false;
            if (tab.dataset.tab === 'upcoming') renderReminderModal();
        });
    });

    document.getElementById('requestNotifPermBtn')?.addEventListener('click', () => {
        if (!('Notification' in window)) { showToast('Browser does not support notifications.', 'error'); return; }
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
                showToast('Notifications enabled!', 'success');
                fireNotificationsIfDue();
            } else {
                showToast('Notification permission denied.', 'error');
            }
            renderReminderModal();
            updateReminderBadge();
        });
    });

    document.getElementById('reminderDaysSlider')?.addEventListener('input', function () {
        const label = document.getElementById('reminderDaysLabel');
        if (label) label.textContent = this.value;
        // A11Y: sync aria-valuenow
        this.setAttribute('aria-valuenow', this.value);
        localStorage.setItem('reminderDays', this.value);
        updateReminderBadge();
    });

    // ============================================================
    // FEATURE 3: CREDIT CARD EMI TRACKER
    // ============================================================
    function renderCCEmiTracker() {
        const grid = document.getElementById('cc-emi-tracker-grid');
        if (!grid) return;

        const ccEmiLoans = currentLoanData.filter(l =>
            l.description.toLowerCase().includes('credit card') && l.monthsRemaining > 0
        );

        const ccBankMap = {};
        creditCardData1.forEach(c => { ccBankMap[c.name.toUpperCase()] = c; });

        grid.innerHTML = '';
        if (!ccEmiLoans.length) {
            const p = document.createElement('p');
            p.style.cssText = 'color:#64748b;font-size:0.85em;padding:12px 0;';
            p.textContent = 'No active credit card EMI conversions detected.';
            grid.appendChild(p);
            return;
        }

        ccEmiLoans.forEach(loan => {
            let matchedCard = null;
            for (const [key, card] of Object.entries(ccBankMap)) {
                if (key.includes(loan.bankName.replace(' BANK','').replace(' FINANCE','')) ||
                    loan.bankName.includes(key.split(' ')[0])) {
                    matchedCard = card; break;
                }
            }

            const emiOutstanding = loan.currentRemainingAmount;
            const rawOutstanding = matchedCard
                ? Math.max(0, matchedCard.currentOutstanding - emiOutstanding)
                : null;

            const card = document.createElement('div');
            card.className = 'cc-emi-card';
            card.innerHTML = `
                <div class="cc-emi-card-header">
                    <span class="cc-emi-bank">${sanitize(loan.bankName)}</span>
                    <span class="cc-emi-badge">EMI Conversion</span>
                </div>
                <div class="cc-emi-desc">${sanitize(loan.description)}</div>
                <div class="cc-emi-rows">
                    <div class="cc-emi-row"><span>Monthly EMI</span><strong>₹${loan.emi.toLocaleString('en-IN')}</strong></div>
                    <div class="cc-emi-row"><span>EMI Outstanding</span><strong class="emi-amt">₹${emiOutstanding.toLocaleString('en-IN')}</strong></div>
                    ${rawOutstanding !== null ? `<div class="cc-emi-row"><span>Raw CC Outstanding</span><strong class="raw-amt">₹${rawOutstanding.toLocaleString('en-IN')}</strong></div>` : ''}
                    <div class="cc-emi-row"><span>Months Remaining</span><strong>${loan.monthsRemaining}</strong></div>
                    <div class="cc-emi-row"><span>Interest Rate</span><strong>${loan.annualInterestRate}%</strong></div>
                    <div class="cc-emi-row"><span>Next EMI Due</span><strong>${sanitize(loan.nextEmiDate)}</strong></div>
                </div>
                <div class="cc-emi-status ${loan.dueCountdownClass}">${sanitize(loan.dueCountdown)}</div>`;
            grid.appendChild(card);
        });
    }

    // ============================================================
    // FEATURE 4: MONTHLY CASH FLOW CALENDAR
    // ============================================================
    let cashflowDate = new Date();
    cashflowDate.setDate(1);

    function positionCalTip(e, tipBox) {
        const margin = 12;
        const tw = tipBox.offsetWidth || 220;
        const th = tipBox.offsetHeight || 100;
        let x = e.clientX + margin;
        let y = e.clientY + margin;
        if (x + tw > window.innerWidth - 8)  x = e.clientX - tw - margin;
        if (y + th > window.innerHeight - 8) y = e.clientY - th - margin;
        tipBox.style.left = `${x}px`;
        tipBox.style.top  = `${y}px`;
    }

    // Build emiMap for any given year/month offset from cashflowDate
    function buildEmiMapForOffset(offsetMonths) {
        const d = new Date(cashflowDate.getFullYear(), cashflowDate.getMonth() + offsetMonths, 1);
        const year  = d.getFullYear();
        const month = d.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const map = {};
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
                if (!map[emiDay]) map[emiDay] = [];
                map[emiDay].push(loan);
            }
        });
        return { map, year, month, daysInMonth };
    }

    function emiMapTotal(map) {
        return Object.values(map).flat().reduce((s, l) => s + l.emi, 0);
    }

    function renderMomTrend(currentTotal) {
        const trendEl = document.getElementById('cashflow-mom-trend');
        if (!trendEl) return;

        const prevData = buildEmiMapForOffset(-1);
        const nextData = buildEmiMapForOffset(+1);
        const prevTotal = emiMapTotal(prevData.map);
        const nextTotal = emiMapTotal(nextData.map);

        const maxVal = Math.max(prevTotal, currentTotal, nextTotal, 1);

        const fmtMonth = (year, month) => new Date(year, month, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
        const fmtAmt   = v => v > 0 ? `₹${(v/1000).toFixed(1)}k` : '—';

        const delta = (curr, prev) => {
            if (!prev || !curr) return '';
            const pct = Math.round(((curr - prev) / prev) * 100);
            if (Math.abs(pct) < 1) return `<span class="cf-mom-delta flat">= same</span>`;
            return pct > 0
                ? `<span class="cf-mom-delta up">▲ ${pct}%</span>`
                : `<span class="cf-mom-delta down">▼ ${Math.abs(pct)}%</span>`;
        };

        const makeRow = (label, val, max, extraClass, badgeHtml) => {
            const pct = max > 0 ? Math.round((val / max) * 100) : 0;
            return `<div class="cf-mom-row ${extraClass}">
                <span class="cf-mom-month">${label}</span>
                <div class="cf-mom-bar-wrap"><div class="cf-mom-bar" style="width:${pct}%"></div></div>
                <span class="cf-mom-amount">${fmtAmt(val)}</span>
                <span class="cf-mom-badge-wrap">${badgeHtml}</span>
            </div>`;
        };

        const prevBadge = prevTotal > 0
            ? `<span class="cf-mom-delta paid"><i class="fas fa-check-circle"></i> Paid</span>`
            : `<span class="cf-mom-delta flat">—</span>`;

        trendEl.innerHTML =
            makeRow(fmtMonth(prevData.year, prevData.month), prevTotal, maxVal, 'cf-mom-prev', prevBadge) +
            makeRow(fmtMonth(cashflowDate.getFullYear(), cashflowDate.getMonth()), currentTotal, maxVal, 'cf-mom-current', delta(currentTotal, prevTotal) || '<span class="cf-mom-delta flat">—</span>') +
            makeRow(fmtMonth(nextData.year, nextData.month), nextTotal, maxVal, 'cf-mom-next', delta(nextTotal, currentTotal) || '<span class="cf-mom-delta flat">—</span>');
    }

    function renderTracker(emiMap) {
        const el = document.getElementById('cashflow-tracker');
        if (!el) return;

        const today     = new Date();
        const todayYear  = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDay   = today.getDate();

        const viewYear   = cashflowDate.getFullYear();
        const viewMonth  = cashflowDate.getMonth();

        const isThisMonth = (viewYear === todayYear && viewMonth === todayMonth);
        const isFuture    = (viewYear > todayYear) || (viewYear === todayYear && viewMonth > todayMonth);

        const allLoans  = Object.entries(emiMap); // [[day, loans[]], ...]
        const grandTotal = allLoans.flatMap(([,l]) => l).reduce((s,l) => s + l.emi, 0);

        if (!grandTotal) {
            el.innerHTML = '<div style="text-align:center;color:var(--bank-muted);font-size:0.82rem;padding:16px 0"><i class="fas fa-check-circle"></i> No EMIs this month</div>';
            return;
        }

        if (isFuture) {
            // Future month — just show total, no split
            el.innerHTML = `
                <div class="cf-tracker-split">
                    <div class="cf-tracker-box full">
                        <span class="cf-tracker-box-label"><i class="fas fa-calendar-alt"></i> Total Due</span>
                        <span class="cf-tracker-box-amount">₹${grandTotal.toLocaleString('en-IN')}</span>
                        <span class="cf-tracker-box-sub">${allLoans.length} EMI date${allLoans.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="cf-tracker-caption">Viewing a future month</div>`;
            return;
        }

        if (!isThisMonth) {
            // Past month — everything cleared
            const totalCount = allLoans.flatMap(([,l]) => l).length;
            el.innerHTML = `
                <div class="cf-tracker-split">
                    <div class="cf-tracker-box cleared" style="grid-column:1/-1">
                        <span class="cf-tracker-box-label"><i class="fas fa-check-double"></i> All Cleared</span>
                        <span class="cf-tracker-box-amount">₹${grandTotal.toLocaleString('en-IN')}</span>
                        <span class="cf-tracker-box-sub">${totalCount} EMI${totalCount !== 1 ? 's' : ''} · past month</span>
                    </div>
                </div>
                <div class="cf-tracker-bar-wrap"><div class="cf-tracker-bar-fill" style="width:100%"></div></div>
                <div class="cf-tracker-caption"><strong>100%</strong> cleared</div>`;
            return;
        }

        // Current month — split by today's date
        let cleared = 0, clearedCount = 0;
        let pending = 0, pendingCount = 0;

        allLoans.forEach(([dayStr, loans]) => {
            const day = parseInt(dayStr);
            const amt = loans.reduce((s,l) => s + l.emi, 0);
            if (day < todayDay) {
                cleared     += amt;
                clearedCount += loans.length;
            } else {
                pending     += amt;
                pendingCount += loans.length;
            }
        });

        const clearedPct = grandTotal > 0 ? Math.round((cleared / grandTotal) * 100) : 0;
        const daysLeft   = new Date(cashflowDate.getFullYear(), cashflowDate.getMonth() + 1, 0).getDate() - todayDay;

        el.innerHTML = `
            <div class="cf-tracker-split">
                <div class="cf-tracker-box cleared">
                    <span class="cf-tracker-box-label"><i class="fas fa-check"></i> Cleared</span>
                    <span class="cf-tracker-box-amount">₹${cleared.toLocaleString('en-IN')}</span>
                    <span class="cf-tracker-box-sub">${clearedCount} EMI${clearedCount !== 1 ? 's' : ''} past</span>
                </div>
                <div class="cf-tracker-box pending">
                    <span class="cf-tracker-box-label"><i class="fas fa-clock"></i> Remaining</span>
                    <span class="cf-tracker-box-amount">₹${pending.toLocaleString('en-IN')}</span>
                    <span class="cf-tracker-box-sub">${pendingCount} EMI${pendingCount !== 1 ? 's' : ''} ahead</span>
                </div>
            </div>
            <div class="cf-tracker-bar-wrap">
                <div class="cf-tracker-bar-fill" style="width:${clearedPct}%"></div>
            </div>
            <div class="cf-tracker-caption">
                <strong>${clearedPct}%</strong> Cleared
                ${daysLeft > 0 ? ` · <strong>${daysLeft}</strong> days left in ${cashflowDate.toLocaleString('default', { month: 'long' })}` : ' · Last day of month'}
            </div>`;
    }

    function renderEfficiencyGauge(emiMap) {
        var bodyEl = document.getElementById('cashflow-gauge-body');
        if (!bodyEl) return;

        var viewYear  = cashflowDate.getFullYear();
        var viewMonth = cashflowDate.getMonth();
        var activeLoanSet = new Set(Object.values(emiMap).flat());

        var totalEmi = 0, totalInterest = 0, totalPrincipal = 0;

        activeLoanSet.forEach(function(loan) {
            var loanStart = new Date(
                parseInt(loan.rowElement.dataset.startYear),
                parseInt(loan.rowElement.dataset.startMonth) - 1,
                parseInt(loan.rowElement.dataset.startDay) || 1
            );
            var monthsElapsed = (viewYear - loanStart.getFullYear()) * 12
                + (viewMonth - loanStart.getMonth());
            var mPaid = Math.max(0, Math.min(monthsElapsed, loan.tenureMonths));
            var monthlyRate = loan.annualInterestRate / 1200;
            var remainingP;
            if (monthlyRate === 0) {
                remainingP = Math.max(0, loan.principalAmount - (loan.principalAmount / loan.tenureMonths) * mPaid);
            } else {
                var factor = Math.pow(1 + monthlyRate, mPaid);
                remainingP = Math.max(0, loan.principalAmount * factor - (loan.emi / monthlyRate) * (factor - 1));
            }
            var interestThisMonth  = Math.round(remainingP * monthlyRate);
            var principalThisMonth = Math.max(0, loan.emi - interestThisMonth);
            totalEmi       += loan.emi;
            totalInterest  += interestThisMonth;
            totalPrincipal += principalThisMonth;
        });

        if (!totalEmi) {
            bodyEl.innerHTML = '<div class="cf-gauge-empty"><i class="fas fa-check-circle"></i> No active EMIs this month</div>';
            return;
        }

        totalInterest  = Math.min(totalInterest,  totalEmi);
        totalPrincipal = Math.min(totalPrincipal, totalEmi);

        var principalPct = Math.round((totalPrincipal / totalEmi) * 100);
        var interestPct  = 100 - principalPct;
        var fmt2 = function(v) { return '\u20B9' + v.toLocaleString('en-IN'); };

        var qualityLabel, qualityClass;
        if (principalPct >= 70) {
            qualityLabel = 'Excellent \u2014 most payment builds equity';
            qualityClass = 'cf-gauge-quality excellent';
        } else if (principalPct >= 50) {
            qualityLabel = 'Good \u2014 over half is reducing your debt';
            qualityClass = 'cf-gauge-quality good';
        } else if (principalPct >= 30) {
            qualityLabel = 'Fair \u2014 interest is still the bigger share';
            qualityClass = 'cf-gauge-quality fair';
        } else {
            qualityLabel = 'Early stage \u2014 most payment is interest for now';
            qualityClass = 'cf-gauge-quality early';
        }

        bodyEl.innerHTML =
            '<div class="cf-gauge-total">' +
                '<span class="cf-gauge-total-label">This Month\'s Total</span>' +
                '<span class="cf-gauge-total-amount">' + fmt2(totalEmi) + '</span>' +
            '</div>' +
            '<div class="cf-gauge-bar-wrap" role="img" aria-label="Principal ' + principalPct + '%, Interest ' + interestPct + '%">' +
                '<div class="cf-gauge-bar-principal" style="width:' + principalPct + '%"></div>' +
                '<div class="cf-gauge-bar-interest" style="width:' + interestPct + '%"></div>' +
            '</div>' +
            '<div class="cf-gauge-legend">' +
                '<div class="cf-gauge-legend-item">' +
                    '<span class="cf-gauge-legend-dot principal-dot"></span>' +
                    '<div class="cf-gauge-legend-text">' +
                        '<span class="cf-gauge-legend-label">Principal</span>' +
                        '<span class="cf-gauge-legend-amount principal-amount">' + fmt2(totalPrincipal) + '</span>' +
                        '<span class="cf-gauge-legend-pct">' + principalPct + '%</span>' +
                    '</div>' +
                '</div>' +
                '<div class="cf-gauge-divider"></div>' +
                '<div class="cf-gauge-legend-item">' +
                    '<span class="cf-gauge-legend-dot interest-dot"></span>' +
                    '<div class="cf-gauge-legend-text">' +
                        '<span class="cf-gauge-legend-label">Interest</span>' +
                        '<span class="cf-gauge-legend-amount interest-amount">' + fmt2(totalInterest) + '</span>' +
                        '<span class="cf-gauge-legend-pct">' + interestPct + '%</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="' + qualityClass + '">' +
                '<i class="fas fa-info-circle" aria-hidden="true"></i> ' + qualityLabel +
            '</div>';
    }

    function renderCashflowCalendar() {
        const calEl     = document.getElementById('cashflow-calendar');
        const labelEl   = document.getElementById('cashflow-month-label');
        if (!calEl || !labelEl) return;

        const year  = cashflowDate.getFullYear();
        const month = cashflowDate.getMonth();
        labelEl.textContent = cashflowDate.toLocaleString('default', { month: 'long', year: 'numeric' });

        const { map: emiMap, daysInMonth } = buildEmiMapForOffset(0);
        const firstDow = new Date(year, month, 1).getDay();

        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        let html = '<div class="cal-grid">';
        dayNames.forEach(d => { html += `<div class="cal-header-cell">${d}</div>`; });
        for (let i = 0; i < firstDow; i++) html += '<div class="cal-cell cal-empty"></div>';

        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const emis     = emiMap[day] || [];
            const totalEmi = emis.reduce((s, l) => s + l.emi, 0);
            const isDanger = emis.length >= 2;
            const isToday  = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const hasEmi   = emis.length > 0;

            let cellClass = 'cal-cell';
            if (isToday)        cellClass += ' cal-today';
            if (isDanger)       cellClass += ' cal-danger';
            else if (hasEmi)    cellClass += ' cal-has-emi';

            // Build tooltip HTML; all data from local constant — but sanitise bankName/description
            const tooltipLines = emis.map(l =>
                `<div class="cal-tip-line">
                    <span class="cal-tip-bank">${sanitize(l.bankName)}</span>
                    <span class="cal-tip-desc">${sanitize(l.description)}</span>
                    <span class="cal-tip-emi">₹${l.emi.toLocaleString('en-IN')}</span>
                </div>`
            ).join('');
            const tooltipTotal = emis.length > 1
                ? `<div class="cal-tip-total"><span>Total</span><span>₹${totalEmi.toLocaleString('en-IN')}</span></div>`
                : '';
            const monthShort = cashflowDate.toLocaleString('default', { month: 'short' });
            const tooltipHtml = hasEmi
                ? `<div class="cal-tip-header"><span>${day} ${monthShort}</span><span>${emis.length} EMI${emis.length > 1 ? 's' : ''}</span></div>${tooltipLines}${tooltipTotal}`
                : '';

            html += `<div class="${cellClass}" data-cal-tip="${hasEmi ? encodeURIComponent(tooltipHtml) : ''}">
                <span class="cal-day-num">${day}</span>
                ${hasEmi ? '<span class="cal-emi-dot"></span>' : ''}
                ${hasEmi ? `<span class="cal-emi-total">₹${(totalEmi / 1000).toFixed(0)}k</span>` : ''}
            </div>`;
        }
        html += '</div>';
        calEl.innerHTML = html;

        // Attach hover tooltip to cells with EMI data
        // BATTERY FIX 4: mousemove throttled — only reposition if cursor
        // moved more than 4px since last update, not on every pixel
        const tipBox = document.getElementById('cal-tooltip');
        let _lastTipX = 0, _lastTipY = 0;
        calEl.querySelectorAll('.cal-cell[data-cal-tip]').forEach(cell => {
            const raw = cell.getAttribute('data-cal-tip');
            if (!raw) return;
            cell.addEventListener('mouseenter', (e) => {
                try {
                    tipBox.innerHTML = decodeURIComponent(raw);
                } catch {
                    tipBox.textContent = 'EMI due';
                }
                tipBox.style.display = 'block';
                tipBox.setAttribute('aria-hidden', 'false');
                positionCalTip(e, tipBox);
                _lastTipX = e.clientX; _lastTipY = e.clientY;
            });
            cell.addEventListener('mousemove', (e) => {
                const dx = e.clientX - _lastTipX;
                const dy = e.clientY - _lastTipY;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                    positionCalTip(e, tipBox);
                    _lastTipX = e.clientX; _lastTipY = e.clientY;
                }
            });
            cell.addEventListener('mouseleave', () => {
                tipBox.style.display = 'none';
                tipBox.setAttribute('aria-hidden', 'true');
            });
        });

        // ── Stats bar ──────────────────────────────────────────────
        const statsEl = document.getElementById('cashflow-month-stats');
        const totalMonthEmi  = emiMapTotal(emiMap);
        const emiDaysSorted  = Object.keys(emiMap).map(Number).sort((a, b) => a - b);
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="cashflow-stat-item">
                    <div class="cashflow-stat-label">Total EMI This Month</div>
                    <div class="cashflow-stat-value">₹${totalMonthEmi.toLocaleString('en-IN')}</div>
                </div>
                <div class="cashflow-stat-divider"></div>
                <div class="cashflow-stat-item">
                    <div class="cashflow-stat-label">EMI Dates</div>
                    <div class="cashflow-stat-dates">${emiDaysSorted.join(', ')}</div>
                </div>`;
        }

        // ── Right-column panels ────────────────────────────────────
        renderMomTrend(totalMonthEmi);
        renderTracker(emiMap);
        renderEfficiencyGauge(emiMap);
    }

    document.getElementById('cashflow-prev')?.addEventListener('click', () => {
        cashflowDate.setMonth(cashflowDate.getMonth() - 1);
        renderCashflowCalendar();
    });

    document.getElementById('cashflow-next')?.addEventListener('click', () => {
        cashflowDate.setMonth(cashflowDate.getMonth() + 1);
        renderCashflowCalendar();
    });

    // ============================================================
    // RUN NEW FEATURES
    // ============================================================
    function runNewFeatures() {
        renderInterestRateComparison();
        renderCCEmiTracker();
        renderCashflowCalendar();
        populateAutoDebitLoans();
        updateReminderBadge();
        fireNotificationsIfDue();
    }

    // ============================================================
    // COUNTDOWN TIMER
    // BATTERY FIX 1:
    //  - End date cached once — no DOM querySelectorAll every second
    //  - Fires every 60s not 1s (display shows days, not seconds)
    //  - Pauses when tab is hidden; resumes on tab return
    // ============================================================

    let _cachedEndDate = null;

    function refreshCachedEndDate() {
        _cachedEndDate = getMaxEndDate();
    }

    function updateOverallCountdown() {
        const endDate = _cachedEndDate;
        const now = new Date();
        const el = document.getElementById('overallFreedomText');
        if (!el) return;
        if (!endDate || endDate < now) {
            el.textContent = '🎉 Loan Free!';
            return;
        }
        const { years, months, days } = getTimeComponents(now, endDate);
        el.textContent = `Freedom In: ${years} yrs ${months} mo ${days} days`;
    }

    refreshCachedEndDate();
    updateOverallCountdown();

    let countdownInterval = setInterval(updateOverallCountdown, 60000);

    // Pause when tab hidden, resume when visible — saves CPU in background
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(countdownInterval);
        } else {
            updateOverallCountdown();
            countdownInterval = setInterval(updateOverallCountdown, 60000);
        }
    });

    window.addEventListener('beforeunload', () => clearInterval(countdownInterval));

    if (overallProgressSection) {
        const overallCountdownContainer = document.createElement('div');
        overallCountdownContainer.classList.add('countdown-timer');
        overallProgressSection.appendChild(overallCountdownContainer);
    }

    // ============================================================
    // INITIALISATION
    // ============================================================
    populateCreditCards();
    populateCreditCardTable();
    setupTableSorting();
    initializeDatabase();
    updateDashboard();
    runNewFeatures();

}); // end DOMContentLoaded
