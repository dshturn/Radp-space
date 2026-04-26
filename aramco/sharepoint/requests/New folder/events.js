// events.js (modified for SP2010)
function handleMenuClick(event) {
    event.preventDefault();
    const menuItem = $(this).data('menu-item');
    showTableForMenuItem(menuItem);
}

function showTableForMenuItem(menuItem) {
    // Hide all tables
    $('table').hide();
    
    // Show the selected table
    const tableId = `#${menuItem}-requests-table`;
    $(tableId).show();
    
    // Update the table title
    const tableTitle = $('#table-title');
    tableTitle.text(menuItem.replace('-', ' ').charAt(0).toUpperCase() + 
                   menuItem.replace('-', ' ').slice(1) + ' Requests');
    
    // Load the data for the selected table
    switch(menuItem) {
        case 'active-requests':
            getActiveRequests().then(renderActiveRequests);
            break;
        case 'completed-requests':
            getCompletedRequests().then(renderCompletedRequests);
            break;
        case 'onwcod-requests':
            getOnwcodRequests().then(renderOnwcodRequests);
            break;
        case 'offwcod-wsd-requests':
            getOffwcodwsdRequests().then(renderOffwcodwsdRequests);
            break;
        case 'onwsd-requests':
            getOnwsdRequests().then(renderOnwsdRequests);
            break;
    }
}

function handleRefreshClick() {
    const currentTable = $('#table-title').text();
    if (currentTable === 'Active Requests') {
        getActiveRequests().then(renderActiveRequests);
    } else if (currentTable === 'Completed Requests') {
        getCompletedRequests().then(renderCompletedRequests);
    } else if (currentTable === 'ONWCOD Requests') {
        getOnwcodRequests().then(renderOnwcodRequests);
    } else if (currentTable === 'OFFWCOD&WSD Requests') {
        getOffwcodwsdRequests().then(renderOffwcodwsdRequests);
    } else if (currentTable === 'ONWSD Requests') {
        getOnwsdRequests().then(renderOnwsdRequests);
    }
}

$(document).ready(function() {
    $('#menu-list a').click(handleMenuClick);
    $('#refresh-button').click(handleRefreshClick);
});