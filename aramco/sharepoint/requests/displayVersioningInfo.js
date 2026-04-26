function displayVersioningInfo(record) {
  if (!record.record.Id) {
    console.error('Error: record.record.Id is undefined');
    return;
  }

  let listTitle = '';
  if (record.ListTitle === 'ONWCOD') {
    listTitle = 'ONWCOD%20Assessment%20Requests';
  } else if (record.ListTitle === 'OFFWCOD&WSD') {
    listTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
  } else if (record.ListTitle === 'ONWSD') {
    listTitle = 'ONWSD%20Assessment%20Requests';
  } else if (record.ListTitle === 'SAOWCOD') {
    listTitle = 'SAOWCOD';
  } else if (record.ListTitle === 'SAGWCOD') {
    listTitle = 'SAGWCOD';
  }

  const url = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/versions?$select=UniqueId,VersionId,Modified,Editor/Id,Editor/Name,Status&$expand=Editor`;
  fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json; odata=verbose'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    const versionHistory = data.d.results.map(version => {
      return {
        status: version.Status || 'Unknown',
        modified: version.Modified,
        modifiedBy: version.Editor? version.Editor.LookupValue : 'Unknown'
      };
    });

    // Sort version history by modified date in descending order
    versionHistory.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    // Remove duplicate versions based on status and modified by
    const uniqueVersions = versionHistory.filter((version, index, array) => {
      if (index === 0) return true;
      const previousVersion = array[index - 1];
      return version.modified !== previousVersion.modified;
    });

    // Get the creator of the request
    const creator = uniqueVersions[uniqueVersions.length - 1].modifiedBy;

    // Create table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    table.appendChild(thead);
    table.appendChild(tbody);

    const headerRow = document.createElement('tr');
    thead.appendChild(headerRow);

    const headers = ['Step Title', 'Initiated', 'Initiated By', 'Completed', 'Completed By', 'Step Duration'];
    headers.forEach((header) => {
      const th = document.createElement('th');
      th.style.padding = '10px';
      th.style.border = '1px solid #ddd';
      th.textContent = header;
      headerRow.appendChild(th);
    });

    uniqueVersions.forEach((version, index) => {
      const row = document.createElement('tr');
      tbody.appendChild(row);

      const stepTitleCell = document.createElement('td');
      stepTitleCell.style.padding = '10px';
      stepTitleCell.style.border = '1px solid #ddd';
      stepTitleCell.textContent = version.status;
      row.appendChild(stepTitleCell);

      const initiatedCell = document.createElement('td');
      initiatedCell.style.padding = '10px';
      initiatedCell.style.border = '1px solid #ddd';
      const initiatedDate = new Date(version.modified);
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      };
      const formattedDate = new Intl.DateTimeFormat('en-US', options).format(initiatedDate);
      initiatedCell.textContent = formattedDate;
      row.appendChild(initiatedCell);

      const initiatedByCell = document.createElement('td');
      initiatedByCell.style.padding = '10px';
      initiatedByCell.style.border = '1px solid #ddd';
      initiatedByCell.textContent = version.modifiedBy;
      row.appendChild(initiatedByCell);

      const completedCell = document.createElement('td');
      completedCell.style.padding = '10px';
      completedCell.style.border = '1px solid #ddd';
      if (index > 0) {
        const previousVersion = uniqueVersions[index - 1];
        const completedDate = new Date(previousVersion.modified);
        const options = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: true
        };
        const formattedDate = new Intl.DateTimeFormat('en-US', options).format(completedDate);
        completedCell.textContent = formattedDate;
      } else {
        completedCell.textContent = 'N/A';
      }
      row.appendChild(completedCell);

      const completedByCell = document.createElement('td');
      completedByCell.style.padding = '10px';
      completedByCell.style.border = '1px solid #ddd';
      if (index > 0) {
        const previousVersion = uniqueVersions[index - 1];
        completedByCell.textContent = previousVersion.modifiedBy;
      } else {
        completedByCell.textContent = 'N/A';
      }
      row.appendChild(completedByCell);

      const stepDurationCell = document.createElement('td');
      stepDurationCell.style.padding = '10px';
      stepDurationCell.style.border = '1px solid #ddd';

      // Check if the step title contains the words "completed" and "wcesu"
      if (version.status.toLowerCase().includes('completed') && version.status.toLowerCase().includes('wcesu')) {
        stepDurationCell.textContent = 'N/A';
        stepDurationCell.style.backgroundColor = ''; // Reset background color
      } else {
        if (index > 0) {
          const previousVersion = uniqueVersions[index - 1];
          const initiatedDate = new Date(version.modified);
          const completedDate = new Date(previousVersion.modified);
          const duration = completedDate - initiatedDate;
          const days = Math.floor(duration / (1000 * 60 * 60 * 24));
          const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
          if (days > 0) {
            stepDurationCell.textContent = `${days} days`;
          } else if (hours > 0) {
            stepDurationCell.textContent = `${hours} hours`;
          } else {
            stepDurationCell.textContent = `${minutes} minutes`;
          }

          // Set background color based on duration
          const totalHours = days * 24 + hours;
          if (totalHours <= 48) {
            stepDurationCell.style.backgroundColor = '#4CAF50'; // Green
          } else if (totalHours > 48 && totalHours <= 96) {
            stepDurationCell.style.backgroundColor = 'yellow';
          } else {
            stepDurationCell.style.backgroundColor = 'red';
          }
        } else {
          const initiatedDate = new Date(version.modified);
          const now = new Date();
          const duration = now - initiatedDate;
          const days = Math.floor(duration / (1000 * 60 * 60 * 24));
          const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
          if (days > 0) {
            stepDurationCell.textContent = `${days} days`;
          } else if (hours > 0) {
            stepDurationCell.textContent = `${hours} hours`;
          } else {
            stepDurationCell.textContent = `${minutes} minutes`;
          }

          // Set background color based on duration
          const totalHours = days * 24 + hours;
          if (totalHours <= 48) {
            stepDurationCell.style.backgroundColor = '#4CAF50'; // Green
          } else if (totalHours > 48 && totalHours <= 96) {
            stepDurationCell.style.backgroundColor = 'yellow';
          } else {
            stepDurationCell.style.backgroundColor = 'red';
          }
        }
      }
      row.appendChild(stepDurationCell);
    });

    // Add new row for "Request Duration"
    const requestDurationRow = document.createElement('tr');
    tbody.appendChild(requestDurationRow);

    const requestDurationCell1 = document.createElement('td');
    requestDurationCell1.style.padding = '10px';
    requestDurationCell1.style.border = '1px solid #ddd';
    requestDurationCell1.textContent = 'Request Duration';
    requestDurationRow.appendChild(requestDurationCell1);

    const requestDurationCell2 = document.createElement('td');
    requestDurationCell2.style.padding = '10px';
    requestDurationCell2.style.border = '1px solid #ddd';
    requestDurationCell2.colSpan = 5;
    requestDurationRow.appendChild(requestDurationCell2);

    let totalDays = 0;
    let totalHours = 0;
    let totalMinutes = 0;

    // Get all step duration cells
    const stepDurationCells = tbody.getElementsByTagName('td');
    for (let i = 0; i < stepDurationCells.length; i++) {
      if (i % 6 === 5) { // 6 columns, step duration is the 6th column
        const stepDurationText = stepDurationCells[i].textContent;
        if (stepDurationText.includes('days')) {
          const days = parseInt(stepDurationText.split(' ')[0]);
          totalDays += days;
        } else if (stepDurationText.includes('hours')) {
          const hours = parseInt(stepDurationText.split(' ')[0]);
          totalHours += hours;
        } else if (stepDurationText.includes('minutes')) {
          const minutes = parseInt(stepDurationText.split(' ')[0]);
          totalMinutes += minutes;
        }
      }
    }

    // Convert total hours and minutes to days
    totalDays += Math.floor(totalHours / 24);
    totalHours = totalHours % 24;
    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    // Display the total request duration
    if (totalDays > 0) {
      requestDurationCell2.textContent = `${totalDays} days`;
    } else if (totalHours > 0) {
      requestDurationCell2.textContent = `${totalHours} hours`;
    } else {
      requestDurationCell2.textContent = `${totalMinutes} minutes`;
    }

    // Create tabs
    const tabs = document.createElement('div');
    tabs.style.width = '100%';
    tabs.style.height = '100%';

    const stepsTab = document.createElement('button');
    stepsTab.textContent = 'Steps';
    stepsTab.style.width = '50%';
    stepsTab.style.height = '30px';
    stepsTab.style.backgroundColor = '#4CAF50';
    stepsTab.style.color = 'white';
    stepsTab.style.border = 'none';
    stepsTab.style.cursor = 'pointer';

    const requestInfoTab = document.createElement('button');
    requestInfoTab.textContent = 'Request Information';
    requestInfoTab.style.width = '50%';
    requestInfoTab.style.height = '30px';
    requestInfoTab.style.backgroundColor = '#ccc';
    requestInfoTab.style.color = 'black';
    requestInfoTab.style.border = 'none';
    requestInfoTab.style.cursor = 'pointer';

    tabs.appendChild(stepsTab);
    tabs.appendChild(requestInfoTab);

    // Create content for tabs
    const stepsContent = document.createElement('div');
    stepsContent.style.width = '100%';
    stepsContent.style.height = '100%';
    stepsContent.appendChild(table);

    const requestInfoContent = document.createElement('div');
    requestInfoContent.style.width = '100%';
    requestInfoContent.style.height = '100%';
    requestInfoContent.style.display = 'none';

    // Get request information
    const requestInfoUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})?$select=Created,Title,Service_x0020_Provider,Service_x0020_Type,FileLeafRef,Service_x0020_Provider_x0027_s_x,lorIssueDate,lorValidityDate`;
    fetch(requestInfoUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    })
    .then(response => {
      if (!response.ok) {
        console.log('Error:', response.status, response.statusText);
        return response.text();
      }
      return response.json();
    })
    .then(data => {
      if (data) {
        const requestInfo = data.d;

        // Create table for request information
        const requestInfoTable = document.createElement('table');
        requestInfoTable.style.width = '100%';
        requestInfoTable.style.borderCollapse = 'collapse';

        const requestInfoThead = document.createElement('thead');
        const requestInfoTbody = document.createElement('tbody');

        requestInfoTable.appendChild(requestInfoThead);
        requestInfoTable.appendChild(requestInfoTbody);

        const requestInfoHeaderRow = document.createElement('tr');
        requestInfoThead.appendChild(requestInfoHeaderRow);

        const requestInfoHeaders = ['Field', 'Value'];
        requestInfoHeaders.forEach((header) => {
          const th = document.createElement('th');
          th.style.padding = '10px';
          th.style.border = '1px solid #ddd';
          th.textContent = header;
          requestInfoHeaderRow.appendChild(th);
        });

        const createdRow = document.createElement('tr');
        requestInfoTbody.appendChild(createdRow);

        const createdFieldCell = document.createElement('td');
        createdFieldCell.style.padding = '10px';
        createdFieldCell.style.border = '1px solid #ddd';
        createdFieldCell.textContent = 'Created';
        createdRow.appendChild(createdFieldCell);

        const createdValueCell = document.createElement('td');
        createdValueCell.style.padding = '10px';
        createdValueCell.style.border = '1px solid #ddd';

        if (requestInfo.Created) {
          const createdDate = new Date(requestInfo.Created);
          const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
          };
          const formattedDate = new Intl.DateTimeFormat('en-US', options).format(createdDate);
          createdValueCell.textContent = formattedDate;
        } else {
          createdValueCell.textContent = 'No value available';
        }
        createdRow.appendChild(createdValueCell);

        const createdByRow = document.createElement('tr');
        requestInfoTbody.appendChild(createdByRow);

        const createdByFieldCell = document.createElement('td');
        createdByFieldCell.style.padding = '10px';
        createdByFieldCell.style.border = '1px solid #ddd';
        createdByFieldCell.textContent = 'Created By';
        createdByRow.appendChild(createdByFieldCell);

        const createdByValueCell = document.createElement('td');
        createdByValueCell.style.padding = '10px';
        createdByValueCell.style.border = '1px solid #ddd';
        createdByValueCell.textContent = creator;
        createdByRow.appendChild(createdByValueCell);

        const idRow = document.createElement('tr');
        requestInfoTbody.appendChild(idRow);

        const idFieldCell = document.createElement('td');
        idFieldCell.style.padding = '10px';
        idFieldCell.style.border = '1px solid #ddd';
        idFieldCell.textContent = 'Id';
        idRow.appendChild(idFieldCell);

        const idValueCell = document.createElement('td');
        idValueCell.style.padding = '10px';
        idValueCell.style.border = '1px solid #ddd';
        idValueCell.textContent = record.record.Id;
        idRow.appendChild(idValueCell);

        const titleRow = document.createElement('tr');
        requestInfoTbody.appendChild(titleRow);

        const titleFieldCell = document.createElement('td');
        titleFieldCell.style.padding = '10px';
        titleFieldCell.style.border = '1px solid #ddd';
        titleFieldCell.textContent = 'Title';
        titleRow.appendChild(titleFieldCell);

        const titleValueCell = document.createElement('td');
        titleValueCell.style.padding = '10px';
        titleValueCell.style.border = '1px solid #ddd';
        if (requestInfo.Title) {
          titleValueCell.textContent = requestInfo.Title;
        } else {
          titleValueCell.textContent = 'No value available';
        }
        titleRow.appendChild(titleValueCell);

        const divisionRow = document.createElement('tr');
        requestInfoTbody.appendChild(divisionRow);

        const divisionFieldCell = document.createElement('td');
        divisionFieldCell.style.padding = '10px';
        divisionFieldCell.style.border = '1px solid #ddd';
        divisionFieldCell.textContent = 'Division';
        divisionRow.appendChild(divisionFieldCell);

        const divisionValueCell = document.createElement('td');
        divisionValueCell.style.padding = '10px';
        divisionValueCell.style.border = '1px solid #ddd';
        divisionValueCell.textContent = record.ListTitle;
        divisionRow.appendChild(divisionValueCell);

        const serviceProviderRow = document.createElement('tr');
        requestInfoTbody.appendChild(serviceProviderRow);

        const serviceProviderFieldCell = document.createElement('td');
        serviceProviderFieldCell.style.padding = '10px';
        serviceProviderFieldCell.style.border = '1px solid #ddd';
        serviceProviderFieldCell.textContent = 'Service Provider';
        serviceProviderRow.appendChild(serviceProviderFieldCell);

        const serviceProviderValueCell = document.createElement('td');
        serviceProviderValueCell.style.padding = '10px';
        serviceProviderValueCell.style.border = '1px solid #ddd';
        if (requestInfo['Service_x0020_Provider']) {
          serviceProviderValueCell.textContent = requestInfo['Service_x0020_Provider'];
        } else {
          serviceProviderValueCell.textContent = 'No value available';
        }
        serviceProviderRow.appendChild(serviceProviderValueCell);

const serviceTypeRow = document.createElement('tr');
requestInfoTbody.appendChild(serviceTypeRow);

const serviceTypeFieldCell = document.createElement('td');
serviceTypeFieldCell.style.padding = '10px';
serviceTypeFieldCell.style.border = '1px solid #ddd';
serviceTypeFieldCell.textContent = 'Service Type';
serviceTypeRow.appendChild(serviceTypeFieldCell);

const serviceTypeValueCell = document.createElement('td');
serviceTypeValueCell.style.padding = '10px';
serviceTypeValueCell.style.border = '1px solid #ddd';
if (requestInfo['Service_x0020_Type'] && requestInfo['Service_x0020_Type'].results && requestInfo['Service_x0020_Type'].results.length > 0) {
  serviceTypeValueCell.textContent = requestInfo['Service_x0020_Type'].results[0];
} else if (requestInfo['Service_x0020_Type']) {
  serviceTypeValueCell.textContent = requestInfo['Service_x0020_Type'];
} else {
  serviceTypeValueCell.textContent = 'No value available';
}
serviceTypeRow.appendChild(serviceTypeValueCell);

        const focalPointRow = document.createElement('tr');
        requestInfoTbody.appendChild(focalPointRow);

        const focalPointFieldCell = document.createElement('td');
        focalPointFieldCell.style.padding = '10px';
        focalPointFieldCell.style.border = '1px solid #ddd';
        focalPointFieldCell.textContent = 'Service Provider\'s Focal Point (email, mobile)';
        focalPointRow.appendChild(focalPointFieldCell);

        const focalPointValueCell = document.createElement('td');
        focalPointValueCell.style.padding = '10px';
        focalPointValueCell.style.border = '1px solid #ddd';
        const serviceProviderValue = requestInfo['Service_x0020_Provider_x0027_s_x'] || 'No value available';
        focalPointValueCell.textContent = serviceProviderValue;
        focalPointRow.appendChild(focalPointValueCell);

        const lorIssueDateRow = document.createElement('tr');
        requestInfoTbody.appendChild(lorIssueDateRow);

        const lorIssueDateFieldCell = document.createElement('td');
        lorIssueDateFieldCell.style.padding = '10px';
        lorIssueDateFieldCell.style.border = '1px solid #ddd';
        lorIssueDateFieldCell.textContent = 'LoR Issue Date';
        lorIssueDateRow.appendChild(lorIssueDateFieldCell);

        const lorIssueDateValueCell = document.createElement('td');
        lorIssueDateValueCell.style.padding = '10px';
        lorIssueDateValueCell.style.border = '1px solid #ddd';
        if (requestInfo['lorIssueDate']) {
          const lorIssueDate = new Date(requestInfo['lorIssueDate']);
          if (!isNaN(lorIssueDate.getTime())) {
            const options = {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric'
            };
            lorIssueDateValueCell.textContent = lorIssueDate.toLocaleDateString('en-US', options);
          } else {
            lorIssueDateValueCell.textContent = 'Invalid date';
          }
        } else {
          lorIssueDateValueCell.textContent = 'No value available';
        }
        lorIssueDateRow.appendChild(lorIssueDateValueCell);

        const lorValidityDateRow = document.createElement('tr');
        requestInfoTbody.appendChild(lorValidityDateRow);

        const lorValidityDateFieldCell = document.createElement('td');
        lorValidityDateFieldCell.style.padding = '10px';
        lorValidityDateFieldCell.style.border = '1px solid #ddd';
        lorValidityDateFieldCell.textContent = 'LoR Validity Date';
        lorValidityDateRow.appendChild(lorValidityDateFieldCell);

        const lorValidityDateValueCell = document.createElement('td');
        lorValidityDateValueCell.style.padding = '10px';
        lorValidityDateValueCell.style.border = '1px solid #ddd';
        if (requestInfo['lorValidityDate']) {
          const lorValidityDate = new Date(requestInfo['lorValidityDate']);
          if (!isNaN(lorValidityDate.getTime())) {
            const options = {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric'
            };
            lorValidityDateValueCell.textContent = lorValidityDate.toLocaleDateString('en-US', options);
          } else {
            lorValidityDateValueCell.textContent = 'Invalid date';
          }
        } else {
          lorValidityDateValueCell.textContent = 'No value available';
        }
        lorValidityDateRow.appendChild(lorValidityDateValueCell);

        const attachmentRow = document.createElement('tr');
        requestInfoTbody.appendChild(attachmentRow);

        const attachmentFieldCell = document.createElement('td');
        attachmentFieldCell.style.padding = '10px';
        attachmentFieldCell.style.border = '1px solid #ddd';
        attachmentFieldCell.textContent = 'Attachment';
        attachmentRow.appendChild(attachmentFieldCell);

        const attachmentValueCell = document.createElement('td');
        attachmentValueCell.style.padding = '10px';
        attachmentValueCell.style.border = '1px solid #ddd';
        attachmentRow.appendChild(attachmentValueCell);

        if (requestInfo.FileLeafRef) {
          const attachmentLink = document.createElement('a');
          attachmentLink.href = `https://sharek.aramco.com.sa${requestInfo.FileLeafRef.Url}`;
          attachmentLink.target = '_blank';
          attachmentLink.textContent = requestInfo.FileLeafRef.FileName;
          attachmentValueCell.appendChild(attachmentLink);
        } else {
          attachmentValueCell.textContent = 'No attachment found';
        }

        requestInfoContent.appendChild(requestInfoTable);

        // Get attachment files
        const attachmentUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/AttachmentFiles`;
        fetch(attachmentUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json; odata=verbose'
          }
        })
        .then(response => response.json())
        .then(data => {
          if (data.d && data.d.results && data.d.results.length > 0) {
            const attachmentList = document.createElement('ul');
            data.d.results.forEach(attachment => {
              const attachmentItem = document.createElement('li');
              const attachmentLink = document.createElement('a');
              attachmentLink.href = `https://sharek.aramco.com.sa${attachment.ServerRelativeUrl}`;
              attachmentLink.target = '_blank';
              attachmentLink.textContent = attachment.FileName;
              attachmentItem.appendChild(attachmentLink);
              attachmentList.appendChild(attachmentItem);
            });
            attachmentValueCell.appendChild(attachmentList);
          } else {
            attachmentValueCell.textContent = 'No attachment found';
          }
        })
        .catch(error => {
          console.log('Error occurred');
          console.log(error);
          attachmentValueCell.textContent = 'Error fetching attachments';
        });

        requestInfoContent.appendChild(requestInfoTable);

        // Add event listeners to tabs
        stepsTab.addEventListener('click', () => {
          stepsTab.style.backgroundColor = '#4CAF50';
          stepsTab.style.color = 'white';
          requestInfoTab.style.backgroundColor = '#ccc';
          requestInfoTab.style.color = 'black';
          stepsContent.style.display = 'block';
          requestInfoContent.style.display = 'none';
        });

        requestInfoTab.addEventListener('click', () => {
          requestInfoTab.style.backgroundColor = '#4CAF50';
          requestInfoTab.style.color = 'white';
          stepsTab.style.backgroundColor = '#ccc';
          stepsTab.style.color = 'black';
          requestInfoContent.style.display = 'block';
          stepsContent.style.display = 'none';
        });

        // Create dialogue window
        const dialogueWindow = document.getElementById('dialogue-window-1');
        const dialogueContent = document.getElementById('dialogue-content-1');
        dialogueContent.innerHTML = '';
        dialogueContent.appendChild(tabs);
        dialogueContent.appendChild(stepsContent);
        dialogueContent.appendChild(requestInfoContent);
        dialogueWindow.style.display = 'block';

        document.getElementById('dialogue-close-1').addEventListener('click', () => {
          dialogueWindow.style.display = 'none';
        });
      } else {
        console.log('No request info found');
      }
    })
    .catch(error => {
      console.log('Error occurred');
      console.log(error);
    });
  });
}

export { displayVersioningInfo };