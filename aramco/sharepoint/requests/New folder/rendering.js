// rendering.js (modified for SP2010)
function renderActiveRequests(data) {
    const tbody = $('#active-requests-tbody');
    tbody.empty();
    if (data && data.d && data.d.results) {
        data.d.results.forEach(function(request) {
            if (request && request.Status && typeof request.Status === 'string') {
                if (!request.Status.toLowerCase().includes('completed')) {
                    const row = $('<tr>');
                    row.append($('<td>').text(request.Title));
                    row.append($('<td>').text(request.Division));
                    row.append($('<td>').text(request.Status));
                    row.append($('<td>').text(request.Step_x0020_Duration));
                    row.append($('<td>').text(request.Request_x0020_Duration));
                    tbody.append(row);
                }
            }
        });
    }
}

function renderCompletedRequests(data) {
    const tbody = $('#completed-requests-tbody');
    tbody.empty();
    if (data && data.results) {
        data.results.forEach(function(request) {
            console.log(request);
            if (request && request.Status && typeof request.Status === 'tring') {
                if (request.Status.toLowerCase().includes('completed')) {
                    const row = $('<tr>');
                    row.append($('<td>').text(request.Title));
                    row.append($('<td>').text(request.Division));
                    row.append($('<td>').text(request.Status));
                    row.append($('<td>').text(request.Request_x0020_Duration));
                    tbody.append(row);
                }
            }
        });
    }
}

function renderOnwcodRequests(data) {
    const tbody = $('#onwcod-requests-tbody');
    tbody.empty();
    data.forEach(function(request) {
        if (request && request.title && request.division && request.status && request.requestDuration) {
            const row = $('<tr>');
            row.append($('<td>').text(request.title));
            row.append($('<td>').text(request.division));
            row.append($('<td>').text(request.status));
            row.append($('<td>').text(request.requestDuration));
            tbody.append(row);
        }
    });
}

function renderOffwcodwsdRequests(data) {
    const tbody = $('#offwcod-wsd-requests-tbody');
    tbody.empty();
    data.forEach(function(request) {
        if (request && request.title && request.division && request.status && request.requestDuration) {
            const row = $('<tr>');
            row.append($('<td>').text(request.title));
            row.append($('<td>').text(request.division));
            row.append($('<td>').text(request.status));
            row.append($('<td>').text(request.requestDuration));
            tbody.append(row);
        }
    });
}

function renderOnwsdRequests(data) {
    const tbody = $('#onwsd-requests-tbody');
    tbody.empty();
    data.forEach(function(request) {
        if (request && request.title && request.division && request.status && request.requestDuration) {
            const row = $('<tr>');
            row.append($('<td>').text(request.title));
            row.append($('<td>').text(request.division));
            row.append($('<td>').text(request.status));
            row.append($('<td>').text(request.requestDuration));
            tbody.append(row);
        }
    });
}

