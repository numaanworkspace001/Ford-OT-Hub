let state = {
    budgetsByYear: { "2026": 1000000 },
    weekStartDates: { "2026": "2026-01-01" },
    rates: { "US": 55, "Mexico": 48 },
    viewOffset: 0,
    ll5s: [
        { name: "Damian Off", ll6s: [
            { name: "Rick Adamo", employees: [{name: "John Doe", rateLocation: "US"}, {name: "Jane Smith", rateLocation: "US"}] },
            { name: "Dave Huddle", employees: [{name: "Staff A", rateLocation: "US"}, {name: "Staff B", rateLocation: "Mexico"}] }
        ]},
        { name: "Raju V.", ll6s: [
            { name: "Supervisor X", employees: [{name: "Team member", rateLocation: "US"}] }
        ]}
    ],
    entries: []
};

const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function init() {
    const saved = localStorage.getItem('ford_ot_v3_mobile');
    if (saved) state = JSON.parse(saved);

    // Migrate old data format
    if (state.rate && !state.rates) {
        state.rates = { "US": state.rate, "Mexico": state.rate * 0.87 };
        delete state.rate;
    }

    // Ensure rates object exists
    if (!state.rates) {
        state.rates = { "US": 55, "Mexico": 48 };
    }

    // Migrate employees from strings to objects
    state.ll5s.forEach(ll5 => {
        ll5.ll6s.forEach(ll6 => {
            if (ll6.employees && ll6.employees.length > 0 && typeof ll6.employees[0] === 'string') {
                ll6.employees = ll6.employees.map(emp => ({
                    name: emp,
                    rateLocation: Object.keys(state.rates)[0] || "US"
                }));
            }
        });
    });

    // Reset viewOffset to 0 (today)
    state.viewOffset = 0;

    renderModalDays();
    populateDropdowns();
    populateJumpSelectors();
    refreshUI();
    switchView('worksheet');
}


function switchToYear() {
    const selectedYear = parseInt(document.getElementById('jump-year').value);
    // Jump to Week 1 of selected year
    let week1Start;
    if (state.weekStartDates[selectedYear]) {
        const parts = state.weekStartDates[selectedYear].split('-');
        week1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        week1Start = new Date(selectedYear, 0, 1);
    }
    const today = new Date();
    const currentSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    currentSunday.setDate(currentSunday.getDate() - currentSunday.getDay());
    state.viewOffset = Math.round((week1Start - currentSunday) / (86400000 * 7));
    refreshUI();
}

function renderModalDays() {
    const container = document.getElementById('modal-days-container');
    container.innerHTML = DAYS.map((d, i) => `
        <div class="day-input-circle">
            <span class="text-[10px] font-black text-slate-400 mb-1">${d}</span>
            <input type="number" id="hrs-${i}" value="0" class="w-full bg-transparent text-center font-black text-lg focus:outline-none">
        </div>
    `).join('');
}

function refreshUI() {
    const week = getWeekData(state.viewOffset);

    document.getElementById('header-date-title').innerText = `${week.year}`;
    document.getElementById('display-week-label').innerText = `WEEK ${week.weekNum} OF ${week.year}`;
    document.getElementById('display-range-label').innerText = week.range;

    const annualBudget = state.budgetsByYear[week.year] || 0;
    const spentInYear = state.entries.filter(e => e.weekKey.startsWith(week.year)).reduce((s, e) => s + e.cost, 0);
    const spentThisWeek = state.entries.filter(e => e.weekKey === week.key).reduce((s, e) => s + e.cost, 0);

    // Calculate dynamic budget: remaining budget / remaining weeks
    const remainingBudget = annualBudget - spentInYear;
    const remainingWeeks = Math.max(1, 53 - week.weekNum); // Weeks left in year
    const dynamicWeeklyTarget = Math.max(0, remainingBudget / remainingWeeks);

    document.getElementById('stat-annual-budget').innerText = `$${annualBudget.toLocaleString()}`;
    document.getElementById('stat-week-target').innerText = `$${dynamicWeeklyTarget.toLocaleString(undefined, {maximumFractionDigits:0})}`;
    document.getElementById('stat-week-actual').innerText = `$${spentThisWeek.toLocaleString()}`;

    populateJumpSelectors();
    renderHeatmap(week.key);
}

function getWeekData(offset) {
    const today = new Date();
    let d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    d.setDate(d.getDate() + (offset * 7));

    const currentDate = new Date(d);
    const year = currentDate.getFullYear();

    // Get the Week 1 start date for this year - parse safely to avoid timezone offset
    let week1Start;
    if (state.weekStartDates[year]) {
        const parts = state.weekStartDates[year].split('-');
        week1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        week1Start = new Date(year, 0, 1);
    }

    // Calculate days from Week 1 start
    const daysDiff = Math.floor((currentDate - week1Start) / (86400000));
    let weekNum = Math.floor(daysDiff / 7) + 1;

    // If before Week 1 start, we're in the previous year's last week
    if (daysDiff < 0) {
        const prevYear = year - 1;
        let prevWeek1Start;
        if (state.weekStartDates[prevYear]) {
            const parts = state.weekStartDates[prevYear].split('-');
            prevWeek1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
            prevWeek1Start = new Date(prevYear, 0, 1);
        }
        const yearEnd = new Date(prevYear, 11, 31);
        const totalDays = Math.floor((yearEnd - prevWeek1Start) / (86400000));
        weekNum = Math.floor(totalDays / 7) + 1;
        return getWeekData(offset - Math.ceil(daysDiff / 7));
    }

    const sun = new Date(week1Start);
    sun.setDate(week1Start.getDate() + (weekNum - 1) * 7);
    const sat = new Date(sun);
    sat.setDate(sat.getDate() + 6);

    return {
        sun, sat, weekNum, year,
        key: `${year}-W${String(weekNum).padStart(2, '0')}`,
        range: `${sun.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${sat.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`
    };
}

function renderHeatmap(weekKey) {
    const container = document.getElementById('heatmap-container');
    let rows = "";

    state.ll5s.forEach((ll5, ll5Idx) => {
        ll5.ll6s.forEach((ll6, ll6Idx) => {
            const entries = state.entries.filter(e => e.ll6 === ll6.name && e.weekKey === weekKey);
            const totals = [0,0,0,0,0,0,0];
            const cost = entries.reduce((s, e) => {
                e.hrs.forEach((h, i) => totals[i] += h);
                return s + e.cost;
            }, 0);

            if (cost === 0) return;

            const safeID = (ll5.name + ll6.name).replace(/[^a-z0-9]/gi, '');

            rows += `
                <tr class="border-b border-slate-50 hover:bg-slate-50/30 transition cursor-pointer" onclick="toggleEmpRows('${safeID}')">
                    <td class="p-4 whitespace-nowrap">
                        <p class="text-sm font-black text-slate-800">${ll6.name} ${entries.length > 0 ? '▾' : ''}</p>
                        <p class="text-[10px] font-bold text-slate-400">LL5: ${ll5.name}</p>
                    </td>
                    ${totals.map(t => `<td class="p-4 text-center"><span class="px-2 py-1 rounded-lg text-xs font-black ${t > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-300'}">${t}</span></td>`).join('')}
                    <td class="p-4 text-right font-black text-[#003478]">$${cost.toLocaleString()}</td>
                </tr>
            `;

            entries.forEach((e, idx) => {
                const globalIdx = state.entries.indexOf(e);
                rows += `
                    <tr class="emp-row-${safeID} hidden border-b border-slate-50 bg-slate-50/50">
                        <td class="p-4 pl-10 text-sm">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span>↳ ${e.emp}</span>
                                    <div class="relative group inline">
                                        <span class="cursor-help text-[#0060b6] font-bold">ⓘ</span>
                                        <div class="hidden group-hover:block absolute bg-slate-800 text-white text-xs rounded p-2 z-50 whitespace-nowrap top-0 left-6 shadow-lg">
                                            <div class="font-bold text-amber-300">Program: ${e.prog || 'N/A'}</div>
                                            <div class="font-bold text-amber-300">Location: ${e.loc || 'N/A'}</div>
                                            <div class="font-bold text-amber-300">Reason: ${e.reason || 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>
                                <button onclick="editEntry(${globalIdx})" class="text-blue-500 hover:text-blue-700 font-bold text-xs">✎</button>
                            </div>
                        </td>
                        ${e.hrs.map(h => `<td class="p-4 text-center text-xs text-slate-500">${h}</td>`).join('')}
                        <td class="p-4 text-right text-xs text-slate-500">$${e.cost.toLocaleString()}</td>
                    </tr>
                `;
            });
        });
    });

    container.innerHTML = rows ? `
        <table class="w-full text-left">
            <thead><tr class="bg-slate-50/50"><th class="p-4 text-[10px] font-black text-slate-400 uppercase">Supervisor</th>${DAYS.map(d => `<th class="p-4 text-center text-[10px] font-black text-slate-400">${d}</th>`).join('')}<th class="p-4 text-right text-[10px] font-black text-slate-400 uppercase">Total</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    ` : `<div class="p-10 text-center text-slate-400 font-bold text-sm">No data for this week.</div>`;
}

function switchView(view) {
    document.getElementById('view-worksheet').classList.toggle('hidden', view !== 'worksheet');
    document.getElementById('view-settings').classList.toggle('hidden', view !== 'settings');
    document.getElementById('header-nav').classList.toggle('hidden', view !== 'worksheet');

    // Icon color toggle
    const navs = document.querySelectorAll('nav button');
    navs[0].className = `flex flex-col items-center gap-1 ${view === 'worksheet' ? 'text-[#003478]' : 'text-slate-400'}`;
    navs[1].className = `flex flex-col items-center gap-1 ${view === 'settings' ? 'text-[#003478]' : 'text-slate-400'}`;

    if (view === 'settings') renderSettings();
}

function openModal() { document.getElementById('entry-modal').classList.remove('modal-hidden'); }
function closeModal() { document.getElementById('entry-modal').classList.add('modal-hidden'); }

// Edit Modal Functions
let editModalData = {};

function openEditModal(title, fields, onSubmit) {
    document.getElementById('edit-modal-title').innerText = title;
    const contentDiv = document.getElementById('edit-modal-content');
    contentDiv.innerHTML = fields.map(field => `
        <div>
            <label class="text-xs font-bold text-slate-500 uppercase block mb-2">${field.label}</label>
            <input type="text" id="edit-field-${field.id}" value="${field.value}" placeholder="${field.placeholder || ''}" class="w-full p-3 bg-slate-100 rounded-xl font-bold border-none focus:ring-2 focus:ring-[#003478]">
        </div>
    `).join('');
    editModalData.onSubmit = onSubmit;
    document.getElementById('edit-modal').classList.remove('modal-hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('modal-hidden');
    editModalData = {};
}

function submitEditModal() {
    if (editModalData.onSubmit) {
        editModalData.onSubmit();
    }
    closeEditModal();
}

// Confirmation Modal
let confirmData = {};

function showConfirm(message, onConfirm) {
    const contentDiv = document.getElementById('edit-modal-content');
    contentDiv.innerHTML = `<p class="text-slate-700 font-bold text-center py-4">${message}</p>`;
    document.getElementById('edit-modal-title').innerText = 'Confirm';

    // Update button styling for confirmation
    const cancelBtn = document.querySelector('#edit-modal .border-t + div button:first-child');
    const confirmBtn = document.querySelector('#edit-modal .border-t + div button:last-child');

    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-black';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.className = 'flex-1 bg-red-500 text-white py-3 rounded-xl font-black';

    confirmData.onConfirm = onConfirm;
    confirmData.isConfirm = true;

    document.getElementById('edit-modal').classList.remove('modal-hidden');
}

function closeConfirm() {
    confirmData = {};
    document.getElementById('edit-modal').classList.add('modal-hidden');
}

function submitConfirm() {
    if (confirmData.isConfirm && confirmData.onConfirm) {
        confirmData.onConfirm();
    }
    closeConfirm();
}

function showAlert(message) {
    const contentDiv = document.getElementById('edit-modal-content');
    contentDiv.innerHTML = `<p class="text-slate-700 font-bold text-center py-4">${message}</p>`;
    document.getElementById('edit-modal-title').innerText = 'Alert';

    const cancelBtn = document.querySelector('#edit-modal .border-t + div button:first-child');
    const confirmBtn = document.querySelector('#edit-modal .border-t + div button:last-child');

    cancelBtn.textContent = 'OK';
    cancelBtn.className = 'flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-black';
    cancelBtn.onclick = () => closeEditModal();
    confirmBtn.style.display = 'none';

    confirmData.isConfirm = false;
    document.getElementById('edit-modal').classList.remove('modal-hidden');
}

function populateDropdowns() {
    const l5 = document.getElementById('sel-ll5');
    l5.innerHTML = state.ll5s.map(x => `<option value="${x.name}">${x.name}</option>`).join('');
    updateLL6Dropdown();
}

function updateLL6Dropdown() {
    const ll5 = state.ll5s.find(l => l.name === document.getElementById('sel-ll5').value);
    document.getElementById('sel-ll6').innerHTML = ll5 ? ll5.ll6s.map(x => `<option value="${x.name}">${x.name}</option>`).join('') : '';
    updateEmployeeDropdown();
}

function updateEmployeeDropdown() {
    const ll5 = state.ll5s.find(l => l.name === document.getElementById('sel-ll5').value);
    const ll6 = ll5 ? ll5.ll6s.find(l => l.name === document.getElementById('sel-ll6').value) : null;
    if (!ll6) {
        document.getElementById('sel-emp').innerHTML = '';
        return;
    }
    document.getElementById('sel-emp').innerHTML = ll6.employees.map(emp => {
        const empName = typeof emp === 'string' ? emp : emp.name;
        const location = typeof emp === 'string' ? Object.keys(state.rates)[0] || 'US' : (emp.rateLocation || Object.keys(state.rates)[0] || 'US');
        const rate = state.rates[location] || 55;
        return `<option value="${empName}">${empName} (${location}: $${rate}/hr)</option>`;
    }).join('');
}

function addEntry() {
    const week = getWeekData(state.viewOffset);
    const hrs = [];
    let total = 0;
    for(let i=0; i<7; i++) {
        const val = parseFloat(document.getElementById(`hrs-${i}`).value || 0);
        hrs.push(val); total += val;
    }
    if (total === 0) return alert("Enter hours");

    const ll5 = document.getElementById('sel-ll5').value;
    const ll6 = document.getElementById('sel-ll6').value;
    const emp = document.getElementById('sel-emp').value;
    const rate = getRateForEmployee(ll5, ll6, emp);

    state.entries.push({
        weekKey: week.key,
        ll5: ll5,
        ll6: ll6,
        emp: emp,
        prog: document.getElementById('in-prog').value || "Default",
        loc: document.getElementById('in-loc').value || "N/A",
        reason: document.getElementById('in-reason').value || "N/A",
        cost: total * rate * 1.5,
        hrs
    });

    save(); refreshUI(); closeModal();
    for(let i=0; i<7; i++) document.getElementById(`hrs-${i}`).value = 0;
    document.getElementById('in-prog').value = "";
    document.getElementById('in-loc').value = "";
    document.getElementById('in-reason').value = "";
}

function addYearBudget() {
    const y = document.getElementById('set-new-year').value;
    const b = document.getElementById('set-new-budget').value;
    if(y && b) {
        state.budgetsByYear[y] = parseFloat(b);
        // Initialize week start date for new year if not set
        if (!state.weekStartDates[y]) {
            state.weekStartDates[y] = `${y}-01-01`;
        }
        document.getElementById('set-new-year').value = '';
        document.getElementById('set-new-budget').value = '';
        save();
        renderSettings();
    }
}

function removeYearBudget(yr) {
    showConfirm(`Delete budget for ${yr}?`, () => {
        delete state.budgetsByYear[yr];
        save();
        renderSettings();
    });
}

function renderSettings() {
    const yearSel = document.getElementById('settings-year-selector');
    yearSel.innerHTML = Object.keys(state.budgetsByYear).sort().map(y =>
        `<option value="${y}">${y}</option>`
    ).join('');
    updateBudgetForm();
    renderHierarchy();
    renderRatesList();
}

function getRateForEmployee(ll5Name, ll6Name, empName) {
    const ll5 = state.ll5s.find(l => l.name === ll5Name);
    if (!ll5) return state.rates[Object.keys(state.rates)[0]] || 55;

    const ll6 = ll5.ll6s.find(l => l.name === ll6Name);
    if (!ll6) return state.rates[Object.keys(state.rates)[0]] || 55;

    const emp = ll6.employees.find(e => {
        const name = typeof e === 'string' ? e : e.name;
        return name === empName;
    });
    if (!emp) return state.rates[Object.keys(state.rates)[0]] || 55;

    const location = typeof emp === 'string' ? Object.keys(state.rates)[0] || 'US' : (emp.rateLocation || Object.keys(state.rates)[0] || 'US');
    return state.rates[location] || 55;
}

function updateBudgetForm() {
    const year = document.getElementById('settings-year-selector').value;
    const budgetInput = document.getElementById('settings-budget-input');
    const weekStartInput = document.getElementById('settings-week-start');

    budgetInput.value = state.budgetsByYear[year] || 0;
    weekStartInput.value = state.weekStartDates[year] || `${year}-01-01`;
}

function saveBudgetForYear() {
    const year = document.getElementById('settings-year-selector').value;
    const budget = parseFloat(document.getElementById('settings-budget-input').value) || 0;
    const weekStart = document.getElementById('settings-week-start').value;

    state.budgetsByYear[year] = budget;
    state.weekStartDates[year] = weekStart;
    save();
    refreshUI();
}

function addNewYear() {
    const yearInput = document.getElementById('new-year-input');
    const year = yearInput.value.trim();

    if (!year) {
        showAlert('Please enter a year');
        return;
    }

    if (state.budgetsByYear[year]) {
        showAlert(`Year ${year} already exists`);
        return;
    }

    state.budgetsByYear[year] = 1000000; // Default budget
    state.weekStartDates[year] = `${year}-01-01`; // Default start date
    yearInput.value = '';
    save();
    renderSettings();
    document.getElementById('settings-year-selector').value = year;
    updateBudgetForm();
}

function renderHierarchy() {
    document.getElementById('settings-hierarchy').innerHTML = state.ll5s.map((ll5, ll5Idx) => `
        <div class="border border-slate-200 rounded-xl overflow-hidden">
            <div class="bg-[#003478] text-white p-3 flex justify-between items-center">
                <div class="flex-1">
                    <p class="font-black">${ll5.name}</p>
                    <p class="text-xs opacity-75">${ll5.ll6s.length} supervisor(s)</p>
                </div>
                <button onclick="editLL5Name(${ll5Idx})" class="text-yellow-300 hover:text-white font-bold px-2">✎</button>
                <button onclick="removeLL5(${ll5Idx})" class="text-red-300 hover:text-white font-bold text-xl px-2">×</button>
            </div>

            <div class="p-3 bg-slate-50 space-y-2">
                ${ll5.ll6s.map((ll6, ll6Idx) => `
                    <div class="bg-white border-l-4 border-[#0060b6] p-3 rounded">
                        <div class="flex justify-between items-center mb-2">
                            <p class="font-bold text-slate-700">${ll6.name}</p>
                            <div class="flex gap-1">
                                <button onclick="editLL6Name(${ll5Idx}, ${ll6Idx})" class="text-blue-500 hover:text-blue-700 text-xs font-bold">✎</button>
                                <button onclick="removeLL6(${ll5Idx}, ${ll6Idx})" class="text-red-500 hover:text-red-700 text-xs font-bold">✕</button>
                            </div>
                        </div>
                        <div class="text-xs text-slate-500 mb-2">${ll6.employees.length} employee(s)</div>
                        <div class="space-y-1 mb-2">
                            ${ll6.employees.map((emp, empIdx) => {
                                const empName = typeof emp === 'string' ? emp : emp.name;
                                const empLocation = typeof emp === 'string' ? Object.keys(state.rates)[0] || 'US' : (emp.rateLocation || Object.keys(state.rates)[0] || 'US');
                                return `
                                    <div class="flex justify-between items-center text-xs bg-slate-100 p-2 rounded">
                                        <div>
                                            <div>↳ ${empName}</div>
                                            <div class="text-[10px] text-slate-500 italic">Rate: ${empLocation} ($${state.rates[empLocation] || 0}/hr)</div>
                                        </div>
                                        <div class="flex gap-1">
                                            <button onclick="editEmployee(${ll5Idx}, ${ll6Idx}, ${empIdx})" class="text-blue-500 hover:text-blue-700 font-bold text-xs">✎</button>
                                            <button onclick="removeEmployee(${ll5Idx}, ${ll6Idx}, ${empIdx})" class="text-red-500 hover:text-red-700 font-bold text-xs">×</button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="flex gap-2 mb-2">
                            <input type="text" id="new-emp-${ll5Idx}-${ll6Idx}" placeholder="Add employee" class="flex-1 p-2 bg-white border border-slate-200 rounded text-xs">
                            <select id="new-emp-loc-${ll5Idx}-${ll6Idx}" class="p-2 bg-white border border-slate-200 rounded text-xs font-bold">
                                ${Object.keys(state.rates).map(loc => `<option value="${loc}">${loc}</option>`).join('')}
                            </select>
                            <button onclick="addEmployee(${ll5Idx}, ${ll6Idx})" class="bg-emerald-500 text-white px-3 rounded text-xs font-bold">+</button>
                        </div>
                    </div>
                `).join('')}

                <div class="flex gap-2 mt-2">
                    <input type="text" id="new-ll6-${ll5Idx}" placeholder="Add supervisor" class="flex-1 p-2 bg-white border border-slate-200 rounded text-xs">
                    <button onclick="addLL6(${ll5Idx})" class="bg-blue-500 text-white px-3 rounded text-xs font-bold">+</button>
                </div>
            </div>
        </div>
    `).join('');
    renderRatesList();
}

function renderRatesList() {
    const ratesList = document.getElementById('rates-list');
    if (!ratesList) return;
    ratesList.innerHTML = Object.entries(state.rates).map(([location, rate]) => `
        <div class="flex justify-between items-center bg-slate-100 p-3 rounded-lg">
            <div>
                <p class="font-bold text-slate-700">${location}</p>
                <p class="text-sm font-bold text-emerald-600">$${rate.toFixed(2)}/hr</p>
            </div>
            <div class="flex gap-2">
                <button onclick="editRate('${location}')" class="text-blue-500 hover:text-blue-700 font-bold text-xs">✎</button>
                <button onclick="deleteRate('${location}')" class="text-red-500 hover:text-red-700 font-bold text-xs">×</button>
            </div>
        </div>
    `).join('');
}

function addNewRate() {
    const location = document.getElementById('new-location-input').value.trim();
    const rate = parseFloat(document.getElementById('new-rate-input').value);

    if (!location) {
        showAlert('Enter a location name');
        return;
    }
    if (isNaN(rate) || rate < 0) {
        showAlert('Enter a valid rate');
        return;
    }
    if (state.rates[location]) {
        showAlert(`${location} rate already exists`);
        return;
    }

    state.rates[location] = rate;
    document.getElementById('new-location-input').value = '';
    document.getElementById('new-rate-input').value = '';
    save();
    renderHierarchy();
}

function editRate(location) {
    openEditModal(`Edit Rate: ${location}`, [
        { id: 'rate', label: 'Rate ($/hr)', value: state.rates[location], placeholder: 'Enter rate' }
    ], () => {
        const newRate = parseFloat(document.getElementById('edit-field-rate').value);
        if (!isNaN(newRate) && newRate >= 0) {
            state.rates[location] = newRate;
            save();
            renderHierarchy();
        }
    });
}

function deleteRate(location) {
    if (Object.keys(state.rates).length === 1) {
        showAlert('You must keep at least one rate');
        return;
    }
    showConfirm(`Delete ${location} rate?`, () => {
        delete state.rates[location];
        save();
        renderHierarchy();
    });
}

function editLL5Name(ll5Idx) {
    openEditModal(`Edit Manager Name`, [
        { id: 'name', label: 'Manager Name', value: state.ll5s[ll5Idx].name, placeholder: 'Enter name' }
    ], () => {
        const newName = document.getElementById('edit-field-name').value.trim();
        if (newName) {
            state.ll5s[ll5Idx].name = newName;
            save();
            renderHierarchy();
            populateDropdowns();
        }
    });
}

function editLL6Name(ll5Idx, ll6Idx) {
    openEditModal(`Edit Supervisor Name`, [
        { id: 'name', label: 'Supervisor Name', value: state.ll5s[ll5Idx].ll6s[ll6Idx].name, placeholder: 'Enter name' }
    ], () => {
        const newName = document.getElementById('edit-field-name').value.trim();
        if (newName) {
            state.ll5s[ll5Idx].ll6s[ll6Idx].name = newName;
            save();
            renderHierarchy();
            populateDropdowns();
        }
    });
}

function editEmployee(ll5Idx, ll6Idx, empIdx) {
    const emp = state.ll5s[ll5Idx].ll6s[ll6Idx].employees[empIdx];
    const empName = typeof emp === 'string' ? emp : emp.name;
    const empLocation = typeof emp === 'string' ? Object.keys(state.rates)[0] || 'US' : (emp.rateLocation || Object.keys(state.rates)[0] || 'US');

    const locations = Object.keys(state.rates);
    const locationsHtml = locations.map(loc => `<option value="${loc}" ${loc === empLocation ? 'selected' : ''}>${loc}</option>`).join('');

    const contentDiv = document.getElementById('edit-modal-content');
    contentDiv.innerHTML = `
        <div>
            <label class="text-xs font-bold text-slate-500 uppercase block mb-2">Employee Name</label>
            <input type="text" id="edit-emp-name" value="${empName}" placeholder="Enter name" class="w-full p-3 bg-slate-100 rounded-xl font-bold border-none focus:ring-2 focus:ring-[#003478]">
        </div>
        <div>
            <label class="text-xs font-bold text-slate-500 uppercase block mb-2">Rate Location</label>
            <select id="edit-emp-location" class="w-full p-3 bg-slate-100 rounded-xl font-bold border-none focus:ring-2 focus:ring-[#003478]">
                ${locationsHtml}
            </select>
        </div>
    `;
    document.getElementById('edit-modal-title').innerText = 'Edit Employee';
    editModalData.onSubmit = () => {
        const newName = document.getElementById('edit-emp-name').value.trim();
        const newLocation = document.getElementById('edit-emp-location').value;
        if (newName) {
            state.ll5s[ll5Idx].ll6s[ll6Idx].employees[empIdx] = {
                name: newName,
                rateLocation: newLocation
            };
            save();
            renderHierarchy();
            populateDropdowns();
        }
    };
    document.getElementById('edit-modal').classList.remove('modal-hidden');
}

function setWeek1StartDate(year) {
    const dateInput = document.getElementById(`week-start-${year}`).value;
    if (dateInput) {
        state.weekStartDates[year] = dateInput;
        save();
        refreshUI();
        populateJumpSelectors();
    }
}

function addLL6(ll5Idx) {
    const name = document.getElementById(`new-ll6-${ll5Idx}`).value;
    if (!name) return;
    state.ll5s[ll5Idx].ll6s.push({ name, employees: [] });
    document.getElementById(`new-ll6-${ll5Idx}`).value = '';
    save();
    renderSettings();
    populateDropdowns();
}

function removeLL6(ll5Idx, ll6Idx) {
    showConfirm(`Remove ${state.ll5s[ll5Idx].ll6s[ll6Idx].name}?`, () => {
        state.ll5s[ll5Idx].ll6s.splice(ll6Idx, 1);
        save();
        renderSettings();
        populateDropdowns();
    });
}

function addEmployee(ll5Idx, ll6Idx) {
    const name = document.getElementById(`new-emp-${ll5Idx}-${ll6Idx}`).value;
    const location = document.getElementById(`new-emp-loc-${ll5Idx}-${ll6Idx}`).value;
    if (!name) return;
    state.ll5s[ll5Idx].ll6s[ll6Idx].employees.push({
        name: name,
        rateLocation: location
    });
    document.getElementById(`new-emp-${ll5Idx}-${ll6Idx}`).value = '';
    save();
    renderSettings();
    populateDropdowns();
}

function removeEmployee(ll5Idx, ll6Idx, empIdx) {
    const empName = typeof state.ll5s[ll5Idx].ll6s[ll6Idx].employees[empIdx] === 'string'
        ? state.ll5s[ll5Idx].ll6s[ll6Idx].employees[empIdx]
        : state.ll5s[ll5Idx].ll6s[ll6Idx].employees[empIdx].name;

    showConfirm(`Remove ${empName}?`, () => {
        state.ll5s[ll5Idx].ll6s[ll6Idx].employees.splice(empIdx, 1);
        save();
        renderSettings();
        populateDropdowns();
    });
}

function addLL5() {
    const name = document.getElementById('new-ll5').value;
    if (!name) return;
    state.ll5s.push({ name, ll6s: [] });
    document.getElementById('new-ll5').value = '';
    save();
    renderSettings();
    populateDropdowns();
}

function removeLL5(ll5Idx) {
    showConfirm(`Remove ${state.ll5s[ll5Idx].name}?`, () => {
        state.ll5s.splice(ll5Idx, 1);
        save();
        renderSettings();
        populateDropdowns();
    });
}

function editEntry(entryIdx) {
    const entry = state.entries[entryIdx];
    if (!entry) return;

    // Pre-populate modal with entry data
    document.getElementById('sel-ll5').value = entry.ll5;
    updateLL6Dropdown();
    document.getElementById('sel-ll6').value = entry.ll6;
    updateEmployeeDropdown();
    document.getElementById('sel-emp').value = entry.emp;
    document.getElementById('in-prog').value = entry.prog;
    document.getElementById('in-loc').value = entry.loc;
    document.getElementById('in-reason').value = entry.reason;

    for(let i = 0; i < 7; i++) {
        document.getElementById(`hrs-${i}`).value = entry.hrs[i] || 0;
    }

    // Show modal with delete option
    openModal();

    // Change submit button to "Update" temporarily
    const submitBtn = document.querySelector('[onclick="addEntry()"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Update Entry';
    submitBtn.onclick = () => updateEntry(entryIdx);

    // Show delete button in modal
    let deleteBtn = document.getElementById('entry-delete-btn');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'entry-delete-btn';
        deleteBtn.className = 'w-full bg-red-500 text-white py-3 rounded-2xl font-black text-sm mt-2 active:scale-95 transition';
        deleteBtn.textContent = 'Delete Entry';
        submitBtn.parentElement.appendChild(deleteBtn);
    }
    deleteBtn.style.display = 'block';
    deleteBtn.onclick = () => deleteEntry(entryIdx);
}

function updateEntry(entryIdx) {
    const entry = state.entries[entryIdx];
    const hrs = [];
    let total = 0;
    for(let i=0; i<7; i++) {
        const val = parseFloat(document.getElementById(`hrs-${i}`).value || 0);
        hrs.push(val); total += val;
    }
    if (total === 0) {
        showAlert('Please enter hours');
        return;
    }

    entry.ll5 = document.getElementById('sel-ll5').value;
    entry.ll6 = document.getElementById('sel-ll6').value;
    entry.emp = document.getElementById('sel-emp').value;
    entry.prog = document.getElementById('in-prog').value || "Default";
    entry.loc = document.getElementById('in-loc').value || "N/A";
    entry.reason = document.getElementById('in-reason').value || "N/A";
    entry.hrs = hrs;
    const rate = getRateForEmployee(entry.ll5, entry.ll6, entry.emp);
    entry.cost = total * rate * 1.5;

    save();
    closeModal();
    refreshUI();

    // Reset button
    const submitBtn = document.querySelector('[onclick="addEntry()"]');
    submitBtn.textContent = 'Submit Entry';
    submitBtn.onclick = () => addEntry();
    document.getElementById('entry-delete-btn').style.display = 'none';
}

function deleteEntry(entryIdx) {
    showConfirm('Delete this entry?', () => {
        state.entries.splice(entryIdx, 1);
        save();
        closeModal();

        // Reset button to normal
        const submitBtn = document.querySelector('[onclick="addEntry()"]');
        if (submitBtn) {
            submitBtn.textContent = 'Submit Entry';
            submitBtn.onclick = () => addEntry();
        }
        const deleteBtn = document.getElementById('entry-delete-btn');
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }

        refreshUI();
    });
}

function toggleEmpRows(className) {
    document.querySelectorAll(`.emp-row-${className}`).forEach(r => r.classList.toggle('hidden'));
}

function populateJumpSelectors() {
    const yrSel = document.getElementById('jump-year');
    const wkSel = document.getElementById('jump-week');
    const currentYear = new Date().getFullYear();
    const week = getWeekData(state.viewOffset);

    // Only populate years if empty
    if (yrSel.options.length === 0) {
        for(let y = currentYear - 2; y <= currentYear + 3; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.text = y;
            yrSel.appendChild(opt);
        }
    }

    // Update week dropdown when year changes
    updateWeeksDropdown();

    // Always update current values
    yrSel.value = week.year;
    wkSel.value = week.weekNum;
}

function updateWeeksDropdown() {
    const wkSel = document.getElementById('jump-week');
    const selectedYear = parseInt(document.getElementById('jump-year').value);

    // Clear weeks dropdown
    wkSel.innerHTML = '';

    // Calculate max weeks for this year
    let week1Start;
    if (state.weekStartDates[selectedYear]) {
        const parts = state.weekStartDates[selectedYear].split('-');
        week1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        week1Start = new Date(selectedYear, 0, 1);
    }
    const yearEnd = new Date(selectedYear, 11, 31);
    const daysDiff = Math.floor((yearEnd - week1Start) / 86400000);
    const maxWeeks = Math.floor(daysDiff / 7) + 1;

    // Populate weeks for this year
    for(let w = 1; w <= maxWeeks; w++) {
        const opt = document.createElement('option');
        opt.value = w;
        opt.text = `Week ${w}`;
        wkSel.appendChild(opt);
    }
}

function jumpToWeek() {
    const targetYear = parseInt(document.getElementById('jump-year').value);
    const targetWeek = parseInt(document.getElementById('jump-week').value);

    let week1Start;
    if (state.weekStartDates[targetYear]) {
        const parts = state.weekStartDates[targetYear].split('-');
        week1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        week1Start = new Date(targetYear, 0, 1);
    }

    const targetSunday = new Date(week1Start);
    targetSunday.setDate(week1Start.getDate() + ((targetWeek - 1) * 7));

    const today = new Date();
    const currentSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    currentSunday.setDate(currentSunday.getDate() - currentSunday.getDay());

    state.viewOffset = Math.round((targetSunday - currentSunday) / (86400000 * 7));
    refreshUI();
}

function handleYearChange() {
    updateWeeksDropdown();

    // Find which week today falls into for the selected year
    const selectedYear = parseInt(document.getElementById('jump-year').value);
    const today = new Date();

    let week1Start;
    if (state.weekStartDates[selectedYear]) {
        const parts = state.weekStartDates[selectedYear].split('-');
        week1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        week1Start = new Date(selectedYear, 0, 1);
    }

    const daysDiff = Math.floor((today - week1Start) / 86400000);
    let weekNum = Math.floor(daysDiff / 7) + 1;

    // If today is before Week 1 start of selected year, set to Week 1
    if (daysDiff < 0) {
        weekNum = 1;
    }

    // Get max weeks for this year to ensure we don't exceed it
    const yearEnd = new Date(selectedYear, 11, 31);
    const totalDays = Math.floor((yearEnd - week1Start) / 86400000);
    const maxWeeks = Math.floor(totalDays / 7) + 1;

    // Cap at max weeks if today is after year end
    if (weekNum > maxWeeks) {
        weekNum = maxWeeks;
    }

    document.getElementById('jump-week').value = weekNum;
    jumpToWeek();
}

function changeWeek(dir) {
    const currentWeek = getWeekData(state.viewOffset);
    const nextWeek = getWeekData(state.viewOffset + dir);

    const year = nextWeek.year;
    let week1Start;
    if (state.weekStartDates[year]) {
        const parts = state.weekStartDates[year].split('-');
        week1Start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
        week1Start = new Date(year, 0, 1);
    }
    const yearEnd = new Date(year, 11, 31);

    // Check if trying to go before Week 1 start
    if (nextWeek.sun < week1Start) {
        return; // Don't allow going before Week 1
    }

    // Check if trying to go past end of year (allow one week for partial weeks)
    if (nextWeek.sun > yearEnd) {
        return; // Don't allow going past year end
    }

    state.viewOffset += dir;
    refreshUI();
}

function save() {
    localStorage.setItem('ford_ot_v3_mobile', JSON.stringify(state));
    refreshUI();
}

init();
