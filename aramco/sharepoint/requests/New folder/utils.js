// utils.js

function updateProgressBar() {
  const progressBar = document.getElementById('progress-bar');
  const progress = 0;
  const totalRecords = 100;

  progressBar.style.width = `${(progress / totalRecords) * 100}%`;
}

function getXRequestDigest() {
  return new Promise(function(resolve, reject) {
    $.ajax({
      type: "POST",
      url: 'https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/contextinfo',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose'
      },
      success: function(data) {
        resolve(data.d.GetContextWebInformation.FormDigestValue);
      },
      error: function(xhr, status, error) {
        reject(new Error(`Error getting X-RequestDigest: ${xhr.status}`));
      }
    });
  });
}

function uploadFile(file, fileName, listName, itemId) {
  return new Promise(function(resolve, reject) {
    getXRequestDigest().then(function(xRequestDigest) {
      $.ajax({
        type: "POST",
        url: `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle('${listName}')/items(${itemId})/AttachmentFiles/add(FileName='${fileName}')`,
        headers: {
          'Accept': 'application/json; odata=verbose',
          'X-HTTP-Method': 'POST',
          'Content-Type': 'application/octet-stream',
          'X-RequestDigest': xRequestDigest
        },
        data: file,
        processData: false,
        contentType: false,
        success: function(data) {
          console.log('File uploaded successfully');
          resolve();
        },
        error: function(xhr, status, error) {
          reject(new Error(`Error uploading file: ${xhr.status}`));
        }
      });
    }).catch(function(error) {
      reject(error);
    });
  });
}

function saveStatus(listName, itemId, newStatus) {
  return new Promise(function(resolve, reject) {
    getXRequestDigest().then(function(xRequestDigest) {
      $.ajax({
        type: "POST",
        url: `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle('${listName}')/items(${itemId})`,
        headers: {
          'Accept': 'application/json; odata=verbose',
          'X-HTTP-Method': 'MERGE',
          'Content-Type': 'application/json; odata=verbose',
          'X-RequestDigest': xRequestDigest
        },
        data: JSON.stringify({
          "__metadata": {
            "type": "SP.Data." + listName + "ListItem"
          },
          "Status": newStatus
        }),
        success: function(data) {
          console.log('Status updated successfully');
          resolve();
        },
        error: function(xhr, status, error) {
          reject(new Error(`Error updating status: ${xhr.status}`));
        }
      });
    }).catch(function(error) {
      reject(error);
    });
  });
}

function displayVersioningInfo(record) {
  const versionHistory = record.VersionHistory;
  const versionHistoryTable = document.getElementById('version-history-table');
  versionHistoryTable.innerHTML = '';

  versionHistory.forEach(function(version) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${version.Status}</td>
      <td>${version.Modified}</td>
      <td>${version.ModifiedBy}</td>
    `;
    versionHistoryTable.appendChild(row);
  });
}

function displayChangeStatusDialog(record) {
  const changeStatusDialog = document.getElementById('change-status-dialog');
  changeStatusDialog.style.display = 'block';

  const newStatusSelect = document.getElementById('new-status-select');
  newStatusSelect.innerHTML = '';

  const statusOptions = record.StatusOptions;
  statusOptions.forEach(function(option) {
    const optionElement = document.createElement('option');
    optionElement.value = option;
    optionElement.textContent = option;
    newStatusSelect.appendChild(optionElement);
  });
}

// Utility functions
function formatDuration(duration) {
  // Format duration string
  return `${duration} minutes`;
}
