// API.js (modified for SP2010)
const API_BASE_URL = 'https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/';

function getActiveRequests() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: API_BASE_URL + 'GetByTitle(\'ONWCOD Assessment Requests\')/items',
            method: 'GET',
            headers: {
                'Accept': 'application/json; odata=verbose',
                'X-RequestDigest': $('#__REQUESTDIGEST').val()
            },
            success: function(response) {
                resolve(response.d.results);
            },
            error: function(xhr, status, error) {
                reject(error);
            }
        });
    });
}

function getCompletedRequests() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: API_BASE_URL + 'GetByTitle(\'ONWCOD Assessment Requests\')/items',
            method: 'GET',
            headers: {
                'Accept': 'application/json; odata=verbose'
            },
            success: function(response) {
                const completedRequests = response.d.results.filter(function(item) {
                    return item.Status.includes('Completed');
                });
                resolve(completedRequests);
            },
            error: function(xhr, status, error) {
                reject(error);
            }
        });
    });
}

function getOnwcodRequests() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: API_BASE_URL + 'GetByTitle(\'ONWCOD Assessment Requests\')/items',
            method: 'GET',
            headers: {
                'Accept': 'application/json; odata=verbose'
            },
            success: function(response) {
                resolve(response.d.results);
            },
            error: function(xhr, status, error) {
                reject(error);
            }
        });
    });
}

function getOffwcodwsdRequests() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: API_BASE_URL + 'GetByTitle(\'OFFWCOD&WSD Assessment Requests\')/items',
            method: 'GET',
            headers: {
                'Accept': 'application/json; odata=verbose'
            },
            success: function(response) {
                resolve(response.d.results);
            },
            error: function(xhr, status, error) {
                reject(error);
            }
        });
    });
}

function getOnwsdRequests() {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: API_BASE_URL + 'GetByTitle(\'ONWSD Assessment Requests\')/items',
            method: 'GET',
            headers: {
                'Accept': 'application/json; odata=verbose'
            },
            success: function(response) {
                resolve(response.d.results);
            },
            error: function(xhr, status, error) {
                reject(error);
            }
        });
    });
}