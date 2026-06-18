// Store / Data Management
const StorageKey = 'liquor_samples_db';
const LocationsKey = 'liquor_locations_db';
const TypesKey = 'liquor_types_db';

function getSamples() {
    return JSON.parse(localStorage.getItem(StorageKey) || '[]');
}

function saveSamples(samples) {
    localStorage.setItem(StorageKey, JSON.stringify(samples));
}

function getLocations() {
    let locs = JSON.parse(localStorage.getItem(LocationsKey) || '[]');
    if (locs.length === 0) {
        locs = [
            { id: 'L1', name: 'ห้อง A - ชั้น 1' },
            { id: 'L2', name: 'ห้อง A - ชั้น 2' }
        ];
        saveLocations(locs);
    }
    return locs;
}

function saveLocations(locations) {
    localStorage.setItem(LocationsKey, JSON.stringify(locations));
}

function getTypes() {
    let types = JSON.parse(localStorage.getItem(TypesKey) || '[]');
    if (types.length === 0) {
        types = ['Malt', 'Alcohol', 'Other'];
        saveTypes(types);
    }
    return types;
}

function saveTypes(types) {
    localStorage.setItem(TypesKey, JSON.stringify(types));
}

function generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9);
}

function calculateAging(startDateStr) {
    if (!startDateStr) return '0 Days';
    const start = dayjs(startDateStr);
    const now = dayjs();
    const diffDays = now.diff(start, 'day');
    
    if (diffDays < 30) return `${diffDays} D`;
    const diffMonths = now.diff(start, 'month');
    if (diffMonths < 12) {
        const remDays = now.subtract(diffMonths, 'month').diff(start, 'day');
        return `${diffMonths} M ${remDays > 0 ? remDays + ' D' : ''}`.trim();
    }
    const diffYears = now.diff(start, 'year');
    const remMonths = now.subtract(diffYears, 'year').diff(start, 'month');
    return `${diffYears} Y ${remMonths > 0 ? remMonths + ' M' : ''}`.trim();
}

function getRoomName(locationName) {
    if (locationName.includes('-')) {
        return locationName.split('-')[0].trim();
    }
    return locationName.trim();
}

// Global Variables
let calendarInstance = null;
let currentLocationFilter = null;
let html5QrcodeScanner = null;

function getTypeColorClass(type) {
    if (!type) return 'bg-gray-100 text-gray-700 border-gray-200';
    const t = type.toLowerCase();
    if (t.includes('malt')) return 'bg-amber-100 text-amber-700 border-amber-200';
    if (t.includes('alcohol')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (t.includes('rum')) return 'bg-red-100 text-red-700 border-red-200';
    if (t.includes('vodka')) return 'bg-cyan-100 text-cyan-700 border-cyan-200';
    if (t.includes('gin')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    
    // Hash for consistent random color
    const hash = type.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const colors = ['purple', 'pink', 'indigo', 'teal', 'orange'];
    const c = colors[hash % colors.length];
    return `bg-${c}-100 text-${c}-700 border-${c}-200`;
}

function getTypeHexColor(type) {
    if (!type) return '#6b7280';
    const t = type.toLowerCase();
    if (t.includes('malt')) return '#d97706'; // amber-600
    if (t.includes('alcohol')) return '#2563eb'; // blue-600
    if (t.includes('rum')) return '#dc2626'; // red-600
    if (t.includes('vodka')) return '#0891b2'; // cyan-600
    if (t.includes('gin')) return '#059669'; // emerald-600
    
    // Hash for consistent random color
    const hash = type.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const colors = ['#9333ea', '#db2777', '#4f46e5', '#0d9488', '#ea580c'];
    return colors[hash % colors.length];
}

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;

// Chart instances
let chartTypeInst = null;
let chartRoomInst = null;
let chartAbvInst = null;
let chartTrendInst = null;

$(document).ready(function() {
    
    // --- Navigation ---
    $('.nav-btn').click(function() {
        const target = $(this).data('target');
        
        // Update active class
        $('.nav-btn').removeClass('active text-purple-600 bg-purple-100/50').addClass('text-gray-500');
        $(this).addClass('active text-purple-600 bg-purple-100/50');
        
        // Switch view
        $('.view-section').addClass('hidden').removeClass('active');
        $(`#view-${target}`).removeClass('hidden').addClass('active');

        // Reset location filter if navigating away
        if (target !== 'locations') {
            currentLocationFilter = null;
        }

        // View specific logic
        if (target === 'dashboard') {
            renderDashboard();
        } else if (target === 'add-sample') {
            populateLocationsSelect();
            $('#form-add-sample')[0].reset();
            $('#live-aging').text('0 วัน');
            $('input[name="collectionDate"]').val(dayjs().format('YYYY-MM-DD'));
            updateLiveAging();
        } else if (target === 'locations') {
            renderLocations();
        } else if (target === 'calendar') {
            renderCalendar();
        }
    });

    // --- Dynamic Types Logic ---
    function populateTypes() {
        const types = getTypes();
        
        // Update Filter
        const $filter = $('#filter-type');
        const currentFilterVal = $filter.val();
        $filter.empty();
        $filter.append('<option value="all">All Types</option>');
        types.forEach(t => {
            $filter.append(`<option value="${t}">${t}</option>`);
        });
        if (currentFilterVal && types.includes(currentFilterVal)) {
            $filter.val(currentFilterVal);
        }

        // Update Form Select
        const $select = $('#sample-type-select');
        const currentSelectVal = $select.val();
        $select.empty();
        types.forEach(t => {
            $select.append(`<option value="${t}">${t}</option>`);
        });
        if (currentSelectVal && types.includes(currentSelectVal)) {
            $select.val(currentSelectVal);
        }
    }

    $('#btn-manage-types').click(function() {
        const types = getTypes();
        let typesHtml = types.map((t, index) => `
            <div class="flex justify-between items-center mb-2 bg-gray-50 p-2 rounded border border-gray-200">
                <span>${t}</span>
                <button class="text-red-500 hover:text-red-700 btn-delete-type" data-index="${index}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `).join('');

        Swal.fire({
            title: 'Manage Sample Types',
            html: `
                <div class="text-left mb-4 max-h-48 overflow-y-auto" id="types-list-container">
                    ${typesHtml}
                </div>
                <div class="flex gap-2">
                    <input type="text" id="new-type-input" class="glass-input flex-1 px-3 py-2 rounded border border-gray-300" placeholder="Add new type...">
                    <button id="btn-add-type" class="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">Add</button>
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: 'Done',
            confirmButtonColor: '#9333ea',
            didOpen: () => {
                $('#btn-add-type').click(function() {
                    const newType = $('#new-type-input').val().trim();
                    if (newType && !types.includes(newType)) {
                        types.push(newType);
                        saveTypes(types);
                        Swal.close();
                        $('#btn-manage-types').click(); // Reopen to refresh list
                        populateTypes();
                    }
                });
                $('.btn-delete-type').click(function() {
                    const idx = $(this).data('index');
                    types.splice(idx, 1);
                    saveTypes(types);
                    Swal.close();
                    $('#btn-manage-types').click(); // Reopen
                    populateTypes();
                });
            }
        });
    });

    // --- Dashboard Logic ---
    function renderDashboard() {
        populateTypes(); // Ensure types are up to date
        
        const samples = getSamples();
        const locations = getLocations();
        const searchTerm = $('#search-input').val().toLowerCase();
        const filterType = $('#filter-type').val();
        const filterRoom = $('#filter-room').val() || 'all';

        // Populate Room Filter
        const roomsMap = {};
        locations.forEach(loc => {
            const roomName = getRoomName(loc.name);
            if (!roomsMap[roomName]) {
                roomsMap[roomName] = { count: 0 };
            }
            const countInLoc = samples.filter(s => s.locationId === loc.id).length;
            roomsMap[roomName].count += countInLoc;
        });

        // Update room dropdown options
        const currentRoomVal = $('#filter-room').val();
        $('#filter-room').empty().append('<option value="all">All Rooms</option>');
        Object.keys(roomsMap).forEach(room => {
            $('#filter-room').append(`<option value="${room}">${room}</option>`);
        });
        if (currentRoomVal) $('#filter-room').val(currentRoomVal);

        // Render Zones (Rooms Summary)
        const $zones = $('#zones-container');
        $zones.empty();
        Object.keys(roomsMap).forEach(room => {
            $zones.append(`
                <div class="glass-card p-6 rounded-2xl flex items-center justify-between cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all border border-purple-100 room-card" data-room="${room}">
                    <div>
                        <h3 class="text-lg font-bold text-purple-700">${room}</h3>
                        <p class="text-sm text-gray-500">Click to view location details</p>
                    </div>
                    <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center border border-purple-300 shadow-sm">
                        <span class="text-xl font-bold text-purple-800">${roomsMap[room].count}</span>
                    </div>
                </div>
            `);
        });

        // Filter and Render Table
        let filtered = samples.filter(s => {
            const locName = locations.find(l => l.id === s.locationId)?.name || '';
            const roomName = getRoomName(locName);
            
            const matchSearch = s.name.toLowerCase().includes(searchTerm) || 
                                (s.comment && s.comment.toLowerCase().includes(searchTerm)) || 
                                s.id.toLowerCase().includes(searchTerm);
            const matchType = filterType === 'all' ? true : s.type === filterType;
            const matchRoom = filterRoom === 'all' ? true : roomName === filterRoom;
            
            return matchSearch && matchType && matchRoom;
        });

        const sortDir = $('#sort-duration').val() || 'desc';

        // Sort by Pinned then Collection Date
        filtered.sort((a,b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const dateA = new Date(a.collectionDate);
            const dateB = new Date(b.collectionDate);
            return sortDir === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Pagination Logic
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        const startIdx = (currentPage - 1) * itemsPerPage;
        const pagedSamples = filtered.slice(startIdx, startIdx + itemsPerPage);

        // Update Pagination UI
        if (totalItems === 0) {
            $('#pagination-info').text('Showing 0 items');
        } else {
            $('#pagination-info').text(`Showing ${startIdx + 1}-${Math.min(startIdx + itemsPerPage, totalItems)} of ${totalItems} items`);
        }
        $('#btn-prev-page').prop('disabled', currentPage === 1);
        $('#btn-next-page').prop('disabled', currentPage === totalPages);

        const $tbody = $('#samples-table-body');
        $tbody.empty();
        
        if (pagedSamples.length === 0) {
            $tbody.append(`<tr><td colspan="9" class="p-6 text-center text-gray-500">No samples found</td></tr>`);
        } else {
            pagedSamples.forEach(s => {
            const locName = locations.find(l => l.id === s.locationId)?.name || 'Unknown';
            const aging = calculateAging(s.collectionDate);
            const pinClass = s.isPinned ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500';
            const pinIcon = s.isPinned ? '★' : '☆';
            
            $tbody.append(`
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="p-4 text-center">
                        <input type="checkbox" class="sample-checkbox w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-300" value="${s.id}">
                    </td>
                    <td class="p-4">
                        <div class="flex items-center gap-2">
                            <button class="btn-pin text-xl transition-colors ${pinClass}" data-id="${s.id}" title="Pin/Unpin">${pinIcon}</button>
                            <div>
                                <div class="font-bold text-gray-800">${s.name}</div>
                                <div class="text-[10px] text-gray-400 font-mono mt-0.5">ID: ${s.id}</div>
                                ${s.comment ? `<div class="text-xs text-gray-500 mt-1 break-words">${s.comment}</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="p-4"><span class="px-2 py-1 rounded text-xs border ${getTypeColorClass(s.type)}">${s.type}</span></td>
                    <td class="p-4">${s.proprietor || '-'}</td>
                    <td class="p-4 font-semibold">${s.degree}%</td>
                    <td class="p-4">${locName}</td>
                    <td class="p-4">${dayjs(s.collectionDate).format('DD/MM/YYYY')}</td>
                    <td class="p-4 text-purple-700 font-semibold">${aging}</td>
                    <td class="p-4 whitespace-nowrap">
                        <button class="text-orange-500 hover:text-orange-700 mr-2 btn-edit" data-id="${s.id}" title="Edit">
                            <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button class="text-blue-500 hover:text-blue-700 mr-2 btn-reprint" data-id="${s.id}" title="Print">
                            <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        </button>
                        <button class="text-red-500 hover:text-red-700 btn-delete" data-id="${s.id}" title="Delete">
                            <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            `);
            });
        }

        // Render Charts using filtered data
        renderCharts(filtered, locations);
    }

    // --- Charting Logic ---
    function renderCharts(samples, locations) {
        if (chartTypeInst) chartTypeInst.destroy();
        if (chartRoomInst) chartRoomInst.destroy();
        if (chartAbvInst) chartAbvInst.destroy();
        if (chartTrendInst) chartTrendInst.destroy();

        if (samples.length === 0) return;

        // 1. Types Distribution (Pie)
        const typesCount = {};
        samples.forEach(s => { typesCount[s.type] = (typesCount[s.type] || 0) + 1; });
        
        chartTypeInst = new Chart(document.getElementById('chart-type'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(typesCount),
                datasets: [{
                    data: Object.values(typesCount),
                    backgroundColor: ['#9333ea', '#db2777', '#f59e0b', '#3b82f6', '#10b981']
                }]
            },
            options: {
                responsive: true,
                plugins: { 
                    title: { display: true, text: 'Sample Type Proportion', font: { family: 'Prompt' } }, 
                    legend: { 
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rectRounded',
                            boxWidth: 12,
                            boxHeight: 12,
                            font: { family: 'Prompt', size: 10 }
                        },
                        align: 'center'
                    } 
                },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const label = chartTypeInst.data.labels[elements[0].index];
                        $('#filter-type').val(label).trigger('change');
                    }
                }
            }
        });

        // 2. Room Distribution (Bar)
        const roomsCount = {};
        locations.forEach(loc => {
            const roomName = getRoomName(loc.name);
            if (!roomsCount[roomName]) roomsCount[roomName] = 0;
            roomsCount[roomName] += samples.filter(s => s.locationId === loc.id).length;
        });

        chartRoomInst = new Chart(document.getElementById('chart-room'), {
            type: 'bar',
            data: {
                labels: Object.keys(roomsCount),
                datasets: [{
                    label: 'Number of Samples',
                    data: Object.values(roomsCount),
                    backgroundColor: '#8b5cf6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Samples by Room', font: { family: 'Prompt' } } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const label = chartRoomInst.data.labels[elements[0].index];
                        $('#filter-room').val(label).trigger('change');
                    }
                }
            }
        });

        // 3. Avg ABV by Type (Polar Area or Bar)
        const abvSums = {};
        const abvCounts = {};
        samples.forEach(s => {
            if (!abvSums[s.type]) { abvSums[s.type] = 0; abvCounts[s.type] = 0; }
            abvSums[s.type] += parseFloat(s.degree) || 0;
            abvCounts[s.type]++;
        });
        const abvAvgs = Object.keys(abvSums).map(t => (abvSums[t] / abvCounts[t]).toFixed(1));

        chartAbvInst = new Chart(document.getElementById('chart-abv'), {
            type: 'bar',
            data: {
                labels: Object.keys(abvSums),
                datasets: [{
                    label: 'Avg ABV (%)',
                    data: abvAvgs,
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Average ABV by Type', font: { family: 'Prompt' } } },
                scales: { y: { beginAtZero: true } },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const label = chartAbvInst.data.labels[elements[0].index];
                        $('#filter-type').val(label).trigger('change');
                    }
                }
            }
        });

        // 4. Trend over time (Line)
        const monthlyCount = {};
        samples.forEach(s => {
            const m = dayjs(s.collectionDate).format('YYYY-MM');
            monthlyCount[m] = (monthlyCount[m] || 0) + 1;
        });
        // Sort months
        const sortedMonths = Object.keys(monthlyCount).sort();
        const trendData = sortedMonths.map(m => monthlyCount[m]);

        chartTrendInst = new Chart(document.getElementById('chart-trend'), {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: 'Samples Added',
                    data: trendData,
                    borderColor: '#ec4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Monthly Sample Intake', font: { family: 'Prompt' } } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                onClick: (e, elements) => {
                    if (elements.length > 0) {
                        const label = chartTrendInst.data.labels[elements[0].index];
                        $('#search-input').val(label).trigger('input');
                    }
                }
            }
        });
    }

    $(document).on('click', '.room-card', function() {
        const room = $(this).data('room');
        currentLocationFilter = room;
        
        $('.nav-btn').removeClass('active text-purple-600 bg-purple-100/50').addClass('text-gray-500');
        $('[data-target="locations"]').addClass('active text-purple-600 bg-purple-100/50');
        
        $('.view-section').addClass('hidden').removeClass('active');
        $('#view-locations').removeClass('hidden').addClass('active');
        
        renderLocations();
    });

    $('#search-input').on('input', () => { currentPage = 1; renderDashboard(); });
    $('#filter-type').on('change', () => { currentPage = 1; renderDashboard(); });
    $('#filter-room').on('change', () => { currentPage = 1; renderDashboard(); });
    $('#sort-duration').on('change', () => { currentPage = 1; renderDashboard(); });

    $('.btn-clear-filters').click(function() {
        $('#search-input').val('');
        $('#filter-type').val('all');
        $('#filter-room').val('all');
        $('#sort-duration').val('desc');
        currentPage = 1;
        renderDashboard();
    });

    $('#btn-prev-page').click(function() {
        if (currentPage > 1) {
            currentPage--;
            renderDashboard();
        }
    });

    $('#btn-next-page').click(function() {
        currentPage++;
        renderDashboard();
    });

    $('#check-all-samples').change(function() {
        $('.sample-checkbox').prop('checked', $(this).prop('checked'));
    });

    $(document).on('click', '.btn-pin', function() {
        const id = $(this).data('id');
        let samples = getSamples();
        const sample = samples.find(s => s.id === id);
        if (sample) {
            sample.isPinned = !sample.isPinned;
            saveSamples(samples);
            renderDashboard();
        }
    });

    $('#btn-print-selected').click(function() {
        const selectedIds = $('.sample-checkbox:checked').map(function() { return $(this).val(); }).get();
        if (selectedIds.length === 0) {
            Swal.fire({
                title: 'Please Select Samples',
                text: 'You must select at least 1 sample to print',
                icon: 'warning',
                confirmButtonColor: '#9333ea'
            });
            return;
        }
        const samples = getSamples().filter(s => selectedIds.includes(s.id));
        showStickerModal(samples);
    });

    // --- Add Sample Logic ---
    function populateLocationsSelect() {
        const locations = getLocations();
        const $select = $('#location-select');
        $select.empty();
        locations.forEach(loc => {
            $select.append(`<option value="${loc.id}">${loc.name}</option>`);
        });
    }

    $('input[name="collectionDate"]').on('input', updateLiveAging);

    function updateLiveAging() {
        const date = $('input[name="collectionDate"]').val();
        $('#live-aging').text(calculateAging(date));
    }

    $('#form-add-sample').submit(function(e) {
        e.preventDefault();
        
        const newSample = {
            id: generateId(),
            name: $('input[name="name"]').val(),
            type: $('#sample-type-select').val(),
            proprietor: $('input[name="proprietor"]').val(),
            degree: $('input[name="degree"]').val(),
            locationId: $('#location-select').val(),
            collectionDate: $('input[name="collectionDate"]').val(),
            comment: $('textarea[name="comment"]').val()
        };

        const samples = getSamples();
        samples.push(newSample);
        saveSamples(samples);

        Swal.fire({
            title: 'Saved Successfully!',
            text: 'Generating stickers...',
            icon: 'success',
            confirmButtonColor: '#9333ea',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            showStickerModal([newSample]);
            $('#form-add-sample')[0].reset();
            updateLiveAging();
        });
    });

    // --- Locations Management ---
    function renderLocations() {
        const locations = getLocations();
        const samples = getSamples();
        const $grid = $('#locations-grid');
        $grid.empty();

        let filteredLocations = locations;
        if (currentLocationFilter) {
            filteredLocations = locations.filter(l => getRoomName(l.name) === currentLocationFilter);
            $('#locations-filter-text').text(`Showing only: ${currentLocationFilter}`);
            $('#btn-clear-loc-filter').removeClass('hidden');
        } else {
            $('#locations-filter-text').text('Showing All');
            $('#btn-clear-loc-filter').addClass('hidden');
        }

        filteredLocations.forEach(loc => {
            const count = samples.filter(s => s.locationId === loc.id).length;
            $grid.append(`
                <div class="glass-card p-6 rounded-2xl relative group bg-white border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow btn-view-loc-samples" data-id="${loc.id}">
                    <h3 class="text-xl font-bold text-purple-700 mb-2 pointer-events-none">${loc.name}</h3>
                    <p class="text-gray-500 pointer-events-none">Contains: <span class="text-gray-800 font-bold">${count} samples</span></p>
                    
                    <button class="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600 btn-delete-loc bg-red-50 p-2 rounded-full z-10" data-id="${loc.id}" data-count="${count}">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            `);
        });
    }

    $('#btn-clear-loc-filter').click(function() {
        currentLocationFilter = null;
        renderLocations();
    });

    $('#btn-add-location').click(function() {
        Swal.fire({
            title: 'Add New Location',
            input: 'text',
            inputPlaceholder: 'e.g. Room B - Shelf 3',
            confirmButtonColor: '#9333ea',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            confirmButtonText: 'Save'
        }).then((result) => {
            if (result.isConfirmed && result.value.trim() !== '') {
                const locs = getLocations();
                locs.push({ id: generateId(), name: result.value.trim() });
                saveLocations(locs);
                renderLocations();
            }
        });
    });

    $(document).on('click', '.btn-delete-loc', function() {
        const id = $(this).data('id');
        const count = parseInt($(this).data('count'));

        if (count > 0) {
            Swal.fire({
                title: 'Cannot Delete',
                text: 'There are samples currently stored in this location.',
                icon: 'error',
                confirmButtonColor: '#9333ea'
            });
            return;
        }

        Swal.fire({
            title: 'Confirm Deletion?',
            text: "Do you want to delete this location?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, Delete!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                let locs = getLocations();
                locs = locs.filter(l => l.id !== id);
                saveLocations(locs);
                renderLocations();
            }
        });
    });

    $(document).on('click', '.btn-view-loc-samples', function(e) {
        if ($(e.target).closest('.btn-delete-loc').length > 0) return; // ignore delete button click
        const locId = $(this).data('id');
        const locName = getLocations().find(l => l.id === locId)?.name;
        const samplesInLoc = getSamples().filter(s => s.locationId === locId);
        
        if (samplesInLoc.length === 0) {
            Swal.fire({ title: 'No Samples', text: `No samples stored in ${locName}`, confirmButtonColor: '#9333ea' });
            return;
        }

        let tableHtml = `
            <div class="overflow-y-auto max-h-96">
            <table class="w-full text-left text-sm mt-4 border-collapse">
                <thead><tr class="bg-gray-100"><th class="p-2 border">ID</th><th class="p-2 border">Sample Name</th><th class="p-2 border">Proprietor</th><th class="p-2 border">Type</th><th class="p-2 border">Age</th></tr></thead>
                <tbody>
        `;
        samplesInLoc.forEach(s => {
            tableHtml += `<tr><td class="p-2 border text-gray-500 font-mono text-[10px]">${s.id}</td><td class="p-2 border font-semibold">${s.name}</td><td class="p-2 border">${s.proprietor || '-'}</td><td class="p-2 border"><span class="px-2 py-1 rounded text-xs border ${getTypeColorClass(s.type)}">${s.type}</span></td><td class="p-2 border text-purple-600">${calculateAging(s.collectionDate)}</td></tr>`;
        });
        tableHtml += `</tbody></table></div>`;

        Swal.fire({
            title: `Samples in: ${locName}`,
            html: tableHtml,
            width: '700px',
            confirmButtonText: 'Close',
            confirmButtonColor: '#9333ea'
        });
    });

    // --- Calendar Logic ---
    function renderCalendar() {
        const calendarEl = document.getElementById('calendar-element');
        
        if (calendarInstance) {
            calendarInstance.destroy();
        }

        const samples = getSamples();
        const events = [];

        samples.forEach(s => {
            const hexColor = getTypeHexColor(s.type);
            
            // Collection Event
            events.push({
                title: `Collect: ${s.name}`,
                start: s.collectionDate,
                backgroundColor: hexColor,
                borderColor: hexColor,
                allDay: true,
                extendedProps: { type: 'collection', sample: s }
            });

            // Review Event (e.g. 6 months after)
            const reviewDate = dayjs(s.collectionDate).add(6, 'month').format('YYYY-MM-DD');
            events.push({
                title: `Review: ${s.name}`,
                start: reviewDate,
                backgroundColor: '#dc2626', // Red 600 (kept red for alert/review)
                borderColor: '#dc2626',
                allDay: true,
                extendedProps: { type: 'review', sample: s }
            });
        });

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            events: events,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek'
            },
            eventClick: function(info) {
                const s = info.event.extendedProps.sample;
                Swal.fire({
                    title: info.event.title,
                    html: `
                        <div class="text-left">
                            <p><strong>Type:</strong> ${s.type}</p>
                            <p><strong>Proprietor:</strong> ${s.proprietor || '-'}</p>
                            <p><strong>ABV:</strong> ${s.degree}%</p>
                            <p><strong>Location:</strong> ${getLocations().find(l=>l.id===s.locationId)?.name}</p>
                            <p><strong>Age:</strong> ${calculateAging(s.collectionDate)}</p>
                        </div>
                    `,
                    confirmButtonColor: '#9333ea'
                });
            }
        });

        calendarInstance.render();
    }

    // --- Delete Sample ---
    $(document).on('click', '.btn-delete', function() {
        const id = $(this).data('id');
        Swal.fire({
            title: 'Confirm Deletion?',
            text: "This action cannot be undone!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                let samples = getSamples();
                samples = samples.filter(s => s.id !== id);
                saveSamples(samples);
                renderDashboard();
                Swal.fire({
                    title: 'Deleted!',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    });

    // --- Edit Sample ---
    $(document).on('click', '.btn-edit', function() {
        const id = $(this).data('id');
        const samples = getSamples();
        const sample = samples.find(s => s.id === id);
        if (!sample) return;

        const types = getTypes();
        const typeOptions = types.map(t => `<option value="${t}" ${t === sample.type ? 'selected' : ''}>${t}</option>`).join('');
        
        const locations = getLocations();
        const locOptions = locations.map(l => `<option value="${l.id}" ${l.id === sample.locationId ? 'selected' : ''}>${l.name}</option>`).join('');

        Swal.fire({
            title: 'Edit Sample',
            html: `
                <div class="text-left space-y-4">
                    <div>
                        <label class="block text-sm font-semibold mb-1">Sample Name</label>
                        <input type="text" id="edit-name" class="glass-input w-full px-3 py-2 border rounded" value="${sample.name}">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold mb-1">Type</label>
                            <select id="edit-type" class="glass-input w-full px-3 py-2 border rounded">
                                ${typeOptions}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-1">Proprietor of Spirits</label>
                            <input type="text" id="edit-proprietor" class="glass-input w-full px-3 py-2 border rounded" value="${sample.proprietor || ''}">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-semibold mb-1">ABV (%)</label>
                            <input type="number" step="0.1" id="edit-degree" class="glass-input w-full px-3 py-2 border rounded" value="${sample.degree}">
                        </div>
                        <div>
                            <label class="block text-sm font-semibold mb-1">Storage Location</label>
                            <select id="edit-location" class="glass-input w-full px-3 py-2 border rounded">
                                ${locOptions}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-1">Collection Date</label>
                        <input type="date" id="edit-date" class="glass-input w-full px-3 py-2 border rounded" value="${sample.collectionDate}">
                    </div>
                    <div>
                        <label class="block text-sm font-semibold mb-1">Comments</label>
                        <textarea id="edit-comment" rows="2" class="glass-input w-full px-3 py-2 border rounded">${sample.comment || ''}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Save Changes',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#9333ea',
            width: '600px',
            preConfirm: () => {
                return {
                    name: $('#edit-name').val(),
                    type: $('#edit-type').val(),
                    proprietor: $('#edit-proprietor').val(),
                    degree: $('#edit-degree').val(),
                    locationId: $('#edit-location').val(),
                    collectionDate: $('#edit-date').val(),
                    comment: $('#edit-comment').val(),
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const newData = result.value;
                const index = samples.findIndex(s => s.id === id);
                if (index !== -1) {
                    samples[index] = { ...samples[index], ...newData };
                    saveSamples(samples);
                    renderDashboard();
                    Swal.fire({
                        title: 'Changes Saved!',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
            }
        });
    });

    // --- Sticker / QR Logic ---
    let qrInstances = [];
    function showStickerModal(samplesArray) {
        const $grid = $('#print-grid');
        $grid.empty();

        qrInstances.forEach(qr => qr.clear());
        qrInstances = [];

        samplesArray.forEach((sample, index) => {
            const qrContainerId = `qr-${index}`;
            const dateStr = dayjs(sample.collectionDate).format('DD/MM/YYYY');
            const locName = getLocations().find(l => l.id === sample.locationId)?.name || 'Unknown';
            const comment = sample.comment || '-';
            
            $grid.append(`
                <div class="sticker-item flex flex-col p-4 bg-white text-black w-full" style="font-family: Arial, sans-serif;">
                    <div class="text-center font-bold text-lg leading-tight mb-2 uppercase tracking-wide">LIBRARY OF LIQUOR</div>
                    
                    <div class="flex flex-col items-center justify-center mb-2">
                        <div id="${qrContainerId}" class="p-1 border border-gray-200 rounded w-16 h-16 flex-shrink-0 flex items-center justify-center mb-1"></div>
                        <div class="text-center text-[10px] font-mono">${sample.id}</div>
                    </div>
                    
                    <div class="font-bold text-sm leading-tight mt-1 uppercase">PROPRIETOR OF SPIRITS</div>
                    <div class="text-sm leading-tight mb-1">${sample.proprietor || '-'}</div>
                    
                    <div class="font-bold text-sm leading-tight mt-1 uppercase">ROTATION No.</div>
                    <div class="text-sm leading-tight mb-2">${sample.name}</div>
                    
                    <div class="grid grid-cols-[80px_1fr] text-sm leading-tight gap-y-1 mb-4">
                        <div class="font-bold">degree</div>
                        <div>${sample.degree}</div>
                        <div class="font-bold">date</div>
                        <div>${dateStr}</div>
                        <div class="font-bold">location</div>
                        <div class="truncate">${locName}</div>
                        <div class="font-bold">desc</div>
                        <div class="italic text-gray-700 break-words">${comment}</div>
                    </div>
                    
                    <div class="mt-auto font-bold text-sm text-center pt-2 uppercase">AUTHORISED SIGNATURE</div>
                </div>
            `);

            setTimeout(() => {
                const qr = new QRCode(document.getElementById(qrContainerId), {
                    text: sample.id,
                    width: 56,
                    height: 56,
                    colorDark : "#000000",
                    colorLight : "#ffffff",
                    correctLevel : QRCode.CorrectLevel.L
                });
                qrInstances.push(qr);
            }, 10);
        });

        $('#modal-sticker').removeClass('hidden');
    }

    $(document).on('click', '.btn-reprint', function() {
        const id = $(this).data('id');
        const sample = getSamples().find(s => s.id === id);
        if (sample) showStickerModal([sample]);
    });

    $('.close-modal').click(function() {
        $(this).closest('.fixed').addClass('hidden');
    });

    $('#btn-print-sticker').click(function() {
        window.print();
    });

    // --- Scan QR Logic (Camera + Manual) ---
    $('#btn-scan').click(function() {
        $('#modal-scanner').removeClass('hidden');
        $('#manual-scan-input').val('');
        
        if (!html5QrcodeScanner) {
            html5QrcodeScanner = new Html5Qrcode("qr-reader");
        }
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        // Try facingMode environment (back camera)
        html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
        .catch(err => {
            console.warn("Could not start camera automatically.", err);
        });
    });

    $('#close-scanner').click(function() {
        $('#modal-scanner').addClass('hidden');
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.stop().catch(err => console.error(err));
        }
    });

    function onScanSuccess(decodedText, decodedResult) {
        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
            html5QrcodeScanner.stop();
        }
        $('#modal-scanner').addClass('hidden');
        handleScanResult(decodedText);
    }

    function onScanFailure(error) {
        // Handle scan failure, usually better to ignore and keep scanning
    }

    $('#btn-manual-scan').click(function() {
        const manualId = $('#manual-scan-input').val().trim();
        if (manualId) {
            if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
                html5QrcodeScanner.stop();
            }
            $('#modal-scanner').addClass('hidden');
            handleScanResult(manualId);
        }
    });

    function handleScanResult(sampleId) {
        const samples = getSamples();
        const sample = samples.find(s => s.id === sampleId);

        if (!sample) {
            Swal.fire({
                title: 'Sample Not Found!',
                text: 'The scanned code does not exist in the system.',
                icon: 'error',
                confirmButtonColor: '#9333ea'
            });
            return;
        }

        const locName = getLocations().find(l => l.id === sample.locationId)?.name || 'Unknown';

        Swal.fire({
            title: `Sample Found: ${sample.name}`,
            html: `
                <div class="text-left text-sm bg-gray-50 p-4 rounded-lg mt-2 border border-gray-200">
                    <p class="mb-1"><strong>Proprietor:</strong> ${sample.proprietor || '-'}</p>
                    <p class="mb-1"><strong>Type:</strong> ${sample.type}</p>
                    <p class="mb-1"><strong>Location:</strong> ${locName}</p>
                    <p><strong>Age:</strong> ${calculateAging(sample.collectionDate)}</p>
                </div>
            `,
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: `Close`,
            denyButtonText: `Remove (Delete)`,
            cancelButtonText: `Cancel`,
            confirmButtonColor: '#9333ea',
            denyButtonColor: '#ef4444',
        }).then((result) => {
            if (result.isDenied) {
                let newSamples = samples.filter(s => s.id !== sampleId);
                saveSamples(newSamples);
                renderDashboard();
                Swal.fire({
                    title: 'Removed Successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    }

    // --- Settings / Backup ---
    $('#btn-settings').click(function() {
        Swal.fire({
            title: 'Data Management',
            html: `
                <button id="btn-export" class="w-full mb-3 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-2 px-4 rounded transition-colors">Export Data (Backup)</button>
                <div class="relative">
                    <input type="file" id="import-file" class="hidden" accept=".json">
                    <button id="btn-import" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded transition-colors">Import Data (Restore)</button>
                </div>
            `,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Close'
        });

        $('#btn-export').click(function() {
            const data = {
                samples: getSamples(),
                locations: getLocations(),
                types: getTypes()
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `LiquorLibrary_Backup_${dayjs().format('YYYYMMDD')}.json`);
            dlAnchorElem.click();
            Swal.close();
        });

        $('#btn-import').click(function() {
            $('#import-file').click();
        });

        $('#import-file').change(function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.samples && data.locations) {
                        saveSamples(data.samples);
                        saveLocations(data.locations);
                        if (data.types) saveTypes(data.types);
                        
                        populateTypes();
                        renderDashboard();
                        
                        Swal.fire({
                            title: 'Restore Successful!',
                            icon: 'success',
                            timer: 2000,
                            showConfirmButton: false
                        });
                    } else {
                        throw new Error("Invalid format");
                    }
                } catch (err) {
                    Swal.fire({
                        title: 'Error',
                        text: 'Invalid data file format',
                        icon: 'error',
                        confirmButtonColor: '#9333ea'
                    });
                }
            };
            reader.readAsText(file);
        });
    });

    // Initialize Dashboard
    populateTypes();
    renderDashboard();

});
