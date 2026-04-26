async function fetchData(url) {
  const allItems = [];                     // will hold every record

  // First request – you can add $select/$filter here if you want
  let nextUrl = `${url}?$orderby=Modified desc&$top=5000`;   // Request up to 5000 items at once

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json; odata=verbose' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${nextUrl} – ${response.status}`);
    }

    const data = await response.json();

    // In the classic OData v3 format SharePoint returns results in data.d.results
    allItems.push(...data.d.results);

    // Get the URL for the next set of results
    nextUrl = data.d.__next;
  }

  // Return the same shape the rest of the script expects
  return { d: { results: allItems } };
}

function renderRecord(record, type) {
  const modifiedTime = new Date(record.record.Modified);
  const stepDuration = calculateStepDuration(modifiedTime);
  const editorId = record.record.EditorId;
  const apiUrl = `https://sharek.aramco.com.sa/_api/web/siteusers/getbyid(${editorId})`;
  return fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json; odata=verbose'
    }
  })
  .then(response => response.json())
  .then(data => {
    const editorName = data.d.Title;
    const recordString = JSON.stringify({ Title: record.Title, ListTitle: record.ListTitle, record: record.record });
    console.log('Record string:', recordString);

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
    return fetch(url, {
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
      const versionHistory = [];
      for (var j = 0; j < data.d.results.length; j++) {
        var version = data.d.results[j];
        const modifiedBy = version.Editor? version.Editor.LookupValue : 'Unknown';
        versionHistory.push({
          status: version.Status || 'Unknown',
          modified: version.Modified,
          modifiedBy: modifiedBy
        });
      }
      versionHistory.sort(function (a, b) {
        return new Date(a.modified) - new Date(b.modified);
      });

      let requestDuration = 0;
      for (var i = 0; i < versionHistory.length; i++) {
        if (versionHistory[i].status && versionHistory[i].status.toLowerCase().includes('completed')) {
          break;
        }
        if (i === versionHistory.length - 1) {
          const currentTime = new Date();
          const modifiedTime = new Date(versionHistory[i].modified);
          const stepDuration = Math.floor((currentTime - modifiedTime) / (1000 * 60 * 60 * 24));
          requestDuration += stepDuration;
        } else if (i === 0 && versionHistory.length === 1) {
          const currentTime = new Date();
          const modifiedTime = new Date(versionHistory[i].modified);
          const stepDuration = Math.floor((currentTime - modifiedTime) / (1000 * 60 * 60 * 24));
          requestDuration += stepDuration;
        } else {
          const nextModifiedTime = new Date(versionHistory[i + 1].modified);
          const modifiedTime = new Date(versionHistory[i].modified);
          const stepDuration = Math.floor((nextModifiedTime - modifiedTime) / (1000 * 60 * 60 * 24));
          requestDuration += stepDuration;
        }
      }

      let backgroundColor = '';
      if (requestDuration <= 2) {
        backgroundColor = '#4CAF50';
      } else if (requestDuration >= 3 && requestDuration <= 4) {
        backgroundColor = 'yellow';
      } else {
        backgroundColor = 'red';
      }

      const completionVersion = versionHistory.find(version => version.status.toLowerCase().includes('completed'));
      let completionDate = '';
      if (completionVersion) {
        const completedDate = new Date(completionVersion.modified);
        const month = (completedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = completedDate.getDate().toString().padStart(2, '0');
        const year = completedDate.getFullYear();
        completionDate = `${month}/${day}/${year}`;
      } else {
        completionDate = 'N/A';
      }

      const createdDate = new Date(record.record.Created);
      const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
      const createdDay = createdDate.getDate().toString().padStart(2, '0');
      const createdYear = createdDate.getFullYear();
      const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

      const modifiedDate = new Date(record.record.Modified);
      const modifiedMonth = (modifiedDate.getMonth() + 1).toString().padStart(2, '0');
      const modifiedDay = modifiedDate.getDate().toString().padStart(2, '0');
      const modifiedYear = modifiedDate.getFullYear();
      const formattedModifiedDate = `${modifiedMonth}/${modifiedDay}/${modifiedYear}`;

      if (type === 'Active Requests') {
        const days = parseInt(stepDuration.split(' ')[0]);
        let stepBackgroundColor = '';
        if (days === 0) {
          stepBackgroundColor = '#4CAF50';
        } else if (days === 1) {
          stepBackgroundColor = 'yellow';
        } else {
          stepBackgroundColor = 'red';
        }

        return `
          <tr>
            <td>${record.record.Id}</td>
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'} <button class="change-status-button" data-record="${encodeURIComponent(recordString)}">Change</button></td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
            <td style="background-color: ${stepBackgroundColor}">${days}</td>
            <td>${formattedCreatedDate}</td>
            <td>${formattedModifiedDate}</td>
          </tr>
        `;
      } else if (type === 'Completed Requests') {
        return `
          <tr>
            <td>${record.record.Id}</td>
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'}</td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
            <td>${formattedCreatedDate}</td>
            <td>${completionDate}</td>
          </tr>
        `;
      } else {
        return `
          <tr>
            <td>${record.record.Id}</td>
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'}</td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
            <td>${formattedCreatedDate}</td>
            <td>${formattedModifiedDate}</td>
            <td>${completionDate}</td>
          </tr>
        `;
      }
    })
    .catch(error => {
      console.error('Error:', error);
      const recordString = JSON.stringify({ Title: record.Title, ListTitle: record.ListTitle, record: record.record });
      console.log('Record string:', recordString);
      const requestDuration = Math.floor((new Date() - new Date(record.record.Created)) / (1000 * 60 * 60 * 24));
      let backgroundColor = '';
      if (requestDuration <= 2) {
        backgroundColor = '#4CAF50';
      } else if (requestDuration >= 3 && requestDuration <= 4) {
        backgroundColor = 'yellow';
      } else {
        backgroundColor = 'red';
      }
      if (type === 'Active Requests') {
        const days = parseInt(stepDuration.split(' ')[0]);
        let stepBackgroundColor = '';
        if (days === 0) {
          stepBackgroundColor = '#4CAF50';
        } else if (days === 1) {
          stepBackgroundColor = 'yellow';
        } else {
          stepBackgroundColor = 'red';
        }

        const createdDate = new Date(record.record.Created);
        const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
        const createdDay = createdDate.getDate().toString().padStart(2, '0');
        const createdYear = createdDate.getFullYear();
        const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

        const modifiedDate = new Date(record.record.Modified);
        const modifiedMonth = (modifiedDate.getMonth() + 1).toString().padStart(2, '0');
        const modifiedDay = modifiedDate.getDate().toString().padStart(2, '0');
        const modifiedYear = modifiedDate.getFullYear();
        const formattedModifiedDate = `${modifiedMonth}/${modifiedDay}/${modifiedYear}`;

        return `
          <tr>
            <td>${record.record.Id}</td>
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'} <button class="change-status-button" data-record="${encodeURIComponent(recordString)}">Change</button></td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
            <td style="background-color: ${stepBackgroundColor}">${days}</td>
            <td>${formattedCreatedDate}</td>
            <td>${formattedModifiedDate}</td>
          </tr>
        `;
      } else if (type === 'Completed Requests') {
        const createdDate = new Date(record.record.Created);
        const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
        const createdDay = createdDate.getDate().toString().padStart(2, '0');
        const createdYear = createdDate.getFullYear();
        const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

        return `
          <tr>
            <td>${record.record.Id}</td>
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'}</td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
            <td>${formattedCreatedDate}</td>
            <td>N/A</td>
          </tr>
        `;
      } else {
        const createdDate = new Date(record.record.Created);
        const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
        const createdDay = createdDate.getDate().toString().padStart(2, '0');
        const createdYear = createdDate.getFullYear();
        const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

        const modifiedDate = new Date(record.record.Modified);
        const modifiedMonth = (modifiedDate.getMonth() + 1).toString().padStart(2, '0');
        const modifiedDay = modifiedDate.getDate().toString().padStart(2, '0');
        const modifiedYear = modifiedDate.getFullYear();
        const formattedModifiedDate = `${modifiedMonth}/${modifiedDay}/${modifiedYear}`;

        return `
          <tr>
            <td>${record.record.Id}</td>
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'}</td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
            <td>${formattedCreatedDate}</td>
            <td>${formattedModifiedDate}</td>
            <td>N/A</td>
          </tr>
        `;
      }
    });
  })
  .catch(error => {
    console.error('Error:', error);
    const recordString = JSON.stringify({ Title: record.Title, ListTitle: record.ListTitle, record: record.record });
    console.log('Record string:', recordString);
    const requestDuration = Math.floor((new Date() - new Date(record.record.Created)) / (1000 * 60 * 60 * 24));
    let backgroundColor = '';
    if (requestDuration <= 2) {
      backgroundColor = '#4CAF50';
    } else if (requestDuration >= 3 && requestDuration <= 4) {
      backgroundColor = 'yellow';
    } else {
      backgroundColor = 'red';
    }
    if (type === 'Active Requests') {
      const days = parseInt(stepDuration.split(' ')[0]);
      let stepBackgroundColor = '';
      if (days === 0) {
        stepBackgroundColor = '#4CAF50';
      } else if (days === 1) {
        stepBackgroundColor = 'yellow';
      } else {
        stepBackgroundColor = 'red';
      }

      const createdDate = new Date(record.record.Created);
      const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
      const createdDay = createdDate.getDate().toString().padStart(2, '0');
      const createdYear = createdDate.getFullYear();
      const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

      const modifiedDate = new Date(record.record.Modified);
      const modifiedMonth = (modifiedDate.getMonth() + 1).toString().padStart(2, '0');
      const modifiedDay = modifiedDate.getDate().toString().padStart(2, '0');
      const modifiedYear = modifiedDate.getFullYear();
      const formattedModifiedDate = `${modifiedMonth}/${modifiedDay}/${modifiedYear}`;

      return `
        <tr>
          <td>${record.record.Id}</td>
          <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
          <td>${record.ListTitle}</td>
          <td>${record.record.Status || 'Pending'} <button class="change-status-button" data-record="${encodeURIComponent(recordString)}">Change</button></td>
          <td style="background-color: ${backgroundColor}">${requestDuration}</td>
          <td style="background-color: ${stepBackgroundColor}">${days}</td>
          <td>${formattedCreatedDate}</td>
          <td>${formattedModifiedDate}</td>
        </tr>
      `;
    } else if (type === 'Completed Requests') {
      const createdDate = new Date(record.record.Created);
      const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
      const createdDay = createdDate.getDate().toString().padStart(2, '0');
      const createdYear = createdDate.getFullYear();
      const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

      return `
        <tr>
          <td>${record.record.Id}</td>
          <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
          <td>${record.ListTitle}</td>
          <td>${record.record.Status || 'Pending'}</td>
          <td style="background-color: ${backgroundColor}">${requestDuration}</td>
          <td>${formattedCreatedDate}</td>
          <td>N/A</td>
        </tr>
      `;
    } else {
      const createdDate = new Date(record.record.Created);
      const createdMonth = (createdDate.getMonth() + 1).toString().padStart(2, '0');
      const createdDay = createdDate.getDate().toString().padStart(2, '0');
      const createdYear = createdDate.getFullYear();
      const formattedCreatedDate = `${createdMonth}/${createdDay}/${createdYear}`;

      const modifiedDate = new Date(record.record.Modified);
      const modifiedMonth = (modifiedDate.getMonth() + 1).toString().padStart(2, '0');
      const modifiedDay = modifiedDate.getDate().toString().padStart(2, '0');
      const modifiedYear = modifiedDate.getFullYear();
      const formattedModifiedDate = `${modifiedMonth}/${modifiedDay}/${modifiedYear}`;

      return `
        <tr>
          <td>${record.record.Id}</td>
          <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
          <td>${record.ListTitle}</td>
          <td>${record.record.Status || 'Pending'}</td>
          <td style="background-color: ${backgroundColor}">${requestDuration}</td>
          <td>${formattedCreatedDate}</td>
          <td>${formattedModifiedDate}</td>
          <td>N/A</td>
        </tr>
      `;
    }
  });
}

function calculateStepDuration(modifiedTime) {
  const currentTime = new Date();
  const duration = currentTime - modifiedTime;
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  return `${days} days`;
}

function renderActiveRequests(records, type) {
  const html = records.join('');
  if (type === 'Active Requests') {
    document.querySelector('#active-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'table';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('active-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('active-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#active-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Current Status</th>
      <th>Request Duration, Days</th>
      <th>Step Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
    `;
  } else if (type === 'Completed Requests') {
    document.querySelector('#completed-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'table';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('completed-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#completed-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Completed</th>
    `;
  } else if (type === 'ONWCOD') {
    document.querySelector('#onwcod-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'table';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('onwcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#onwcod-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'OFFWCOD&WSD') {
    document.querySelector('#offwcodwsd-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'table';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('offwcodwsd-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#offwcodwsd-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'ONWSD') {
    document.querySelector('#onwsd-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'table';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('onwsd-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#onwsd-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'SAOWCOD') {
    document.querySelector('#saowcod-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'table';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('saowcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#saowcod-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'SAGWCOD') {
    document.querySelector('#sagwcod-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'table';
    document.getElementById('sagwcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('sagwcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#sagwcod-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  }
  document.getElementById('results-title').innerText = type;

  // Destroy existing DataTables
  if ($.fn.dataTable.isDataTable('#active-requests-table')) {
    $('#active-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#completed-requests-table')) {
    $('#completed-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#onwcod-requests-table')) {
    $('#onwcod-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#offwcodwsd-requests-table')) {
    $('#offwcodwsd-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#onwsd-requests-table')) {
    $('#onwsd-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#saowcod-requests-table')) {
    $('#saowcod-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#sagwcod-requests-table')) {
    $('#sagwcod-requests-table').DataTable().destroy();
  }

  // Initialize DataTables
  if (type === 'Active Requests') {
    $('#active-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": [4, 5], 
          "type": "num"
        }
      ],
      "order": [[7, "desc"]] 
    });
  } else if (type === 'Completed Requests') {
    $('#completed-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'ONWCOD') {
    $('#onwcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'OFFWCOD&WSD') {
    $('#offwcodwsd-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'ONWSD') {
    $('#onwsd-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'SAOWCOD') {
    $('#saowcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'SAGWCOD') {
    $('#sagwcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  }

  // Custom sorting function
  $.fn.dataTable.ext.order['duration'] = function(settings, col) {
    return this.api().column(col, {order: 'index'}).nodes().map(function(td, i) {
      var val = $(td).text().replace(/[^0-9]/g, '');
      return parseInt(val);
    });
  };
}

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
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
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
      titleValueCell.textContent = requestInfo.Title;
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
      serviceProviderValueCell.textContent = requestInfo['Service_x0020_Provider'];
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
      serviceTypeValueCell.textContent = requestInfo['Service_x0020_Type'].results[0];
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
lorIssueDateValueCell.textContent = moment(requestInfo['lorIssueDate']).format('MM/DD/YYYY');
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
lorValidityDateValueCell.textContent = moment(requestInfo['lorValidityDate']).format('MM/DD/YYYY');
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
    });
  });
}

(async () => {
  try {
const urls = [
  'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'ONWCOD Assessment Requests\')/items',
  'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'OFFWCOD&WSD Assessment Requests\')/items',
  'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'ONWSD Assessment Requests\')/items',
  'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'SAOWCOD\')/items',
  'https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle(\'SAGWCOD\')/items'
];
    const listNames = ['ONWCOD', 'OFFWCOD&WSD', 'ONWSD', 'SAOWCOD', 'SAGWCOD'];
    const listGuids = {
  'ONWCOD': 'eb64dd5b-d04e-4357-bfc2-ebcdb7b6aa06',
  'OFFWCOD&WSD': '61a1a83e-2e36-4691-b637-3785b895af8c',
  'ONWSD': 'fe2be0b3-2a99-4245-881e-b530e15377f2',
      'SAOWCOD': 'YOUR_SAOWCOD_LIST_GUID', // Replace with the actual GUID
      'SAGWCOD': 'YOUR_SAGWCOD_LIST_GUID' // Replace with the actual GUID
    };

    const data = await Promise.all(urls.map(fetchData));

    const allData = data.reduce((acc, item, index) => {
      item.d.results.forEach(record => {
        acc.push({ record, listIndex: index });
      });
      return acc;
    }, []);

    allData.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));

    const activeRecords = allData.filter((item) => {
      return !item.record.Status || !item.record.Status.toLowerCase().includes('completed');
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    activeRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));

    const completedRecords = allData.filter((item) => {
      return item.record.Status && item.record.Status.toLowerCase().includes('completed');
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    const onwcodRecords = allData.filter((item) => {
      return listNames[item.listIndex] === 'ONWCOD';
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    const offwcodwsdRecords = allData.filter((item) => {
      return listNames[item.listIndex] === 'OFFWCOD&WSD';
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    const onwsdRecords = allData.filter((item) => {
      return listNames[item.listIndex] === 'ONWSD';
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    const saowcodRecords = allData.filter((item) => {
      return listNames[item.listIndex] === 'SAOWCOD';
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    const sagwcodRecords = allData.filter((item) => {
      return listNames[item.listIndex] === 'SAGWCOD';
    }).map((item) => ({
      Title: item.record.Title,
      ListTitle: listNames[item.listIndex],
      record: item.record
    }));

    activeRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
    completedRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
    onwcodRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
    offwcodwsdRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
    onwsdRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
    saowcodRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
    sagwcodRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));

    const activeRecordsCount = activeRecords.length;
    const completedRecordsCount = completedRecords.length;
    const onwcodRecordsCount = onwcodRecords.length;
    const offwcodwsdRecordsCount = offwcodwsdRecords.length;
    const onwsdRecordsCount = onwsdRecords.length;
    const saowcodRecordsCount = saowcodRecords.length;
    const sagwcodRecordsCount = sagwcodRecords.length;

    document.getElementById('menu').innerHTML = `
      <div class="tile active" data-index="0" data-name="Active Requests">
        <h2>Active Requests</h2>
        <p>${activeRecordsCount}</p>
      </div>
      <div class="tile" data-index="1" data-name="Completed Requests">
        <h2>Completed Requests</h2>
        <p>${completedRecordsCount}</p>
      </div>
      <div class="tile" data-index="2" data-name="ONWCOD">
        <h2>ONWCOD</h2>
        <p>${onwcodRecordsCount}</p>
      </div>
      <div class="tile" data-index="3" data-name="OFFWCOD&WSD">
        <h2>OFFWCOD&WSD</h2>
        <p>${offwcodwsdRecordsCount}</p>
      </div>
      <div class="tile" data-index="4" data-name="ONWSD">
        <h2>ONWSD</h2>
        <p>${onwsdRecordsCount}</p>
      </div>
      <div class="tile" data-index="5" data-name="SAOWCOD">
        <h2>SAOWCOD</h2>
        <p>${saowcodRecordsCount}</p>
      </div>
      <div class="tile" data-index="6" data-name="SAGWCOD">
        <h2>SAGWCOD</h2>
        <p>${sagwcodRecordsCount}</p>
      </div>
    `;

    let progress = 0;
    const totalRecords = allData.length;

    const progressText = document.getElementById('progress-text');

    function updateProgress() {
      progressText.innerText = `Processed ${progress} out of ${totalRecords} records`;
    }

    const processedRecords = new Set();

    const preloadedData = {
      'Active Requests': await Promise.all(activeRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'Active Requests');
      })),
      'Completed Requests': await Promise.all(completedRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'Completed Requests');
      })),
      'ONWCOD': await Promise.all(onwcodRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'ONWCOD');
      })),
      'OFFWCOD&WSD': await Promise.all(offwcodwsdRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'OFFWCOD&WSD');
      })),
      'ONWSD': await Promise.all(onwsdRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'ONWSD');
      })),
      'SAOWCOD': await Promise.all(saowcodRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'SAOWCOD');
      })),
      'SAGWCOD': await Promise.all(sagwcodRecords.map(async (record, index) => {
        if (!processedRecords.has(record.record.Id)) {
          processedRecords.add(record.record.Id);
          progress++;
          updateProgress();
        }
        return renderRecord(record, 'SAGWCOD');
      })),
    };

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('container').style.display = 'flex';

    renderActiveRequests(preloadedData['Active Requests'], 'Active Requests');

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tile') || e.target.parentNode.classList.contains('tile')) {
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach((tile) => {
          tile.classList.remove('active');
        });
        const tile = e.target.classList.contains('tile') ? e.target : e.target.parentNode;
        tile.classList.add('active');
        const index = tile.dataset.index;
        const name = tile.dataset.name;
        renderActiveRequests(preloadedData[name], name);
      } else if (e.target.classList.contains('request-title')) {
        e.preventDefault();
        try {
          const recordString = decodeURIComponent(e.target.dataset.record);
          const record = JSON.parse(recordString);
          displayVersioningInfo(record);
        } catch (error) {
          console.error('Error parsing data-record attribute:', error);
        }
      } 

else if (e.target.classList.contains('change-status-button')) {
  e.preventDefault();
  try {
    const recordString = decodeURIComponent(e.target.dataset.record);
    const record = JSON.parse(recordString);
    const dialogueWindow = document.getElementById('dialogue-window-2');
    const dialogueContent = document.getElementById('dialogue-content-2');
    dialogueContent.innerHTML = '';
    const h2 = document.createElement('h2');
    h2.id = 'change-dialogue-title';
    h2.textContent = 'Change Status';
    dialogueContent.appendChild(h2);
    const p = document.createElement('p');
    p.id = 'change-dialogue-version';
    p.textContent = `Current Status: ${record.record.Status || 'Unknown'}`;
    dialogueContent.appendChild(p);

    const listGuidMap = {
      'ONWCOD': 'eb64dd5b-d04e-4357-bfc2-ebcdb7b6aa06',
      'OFFWCOD&WSD': '61a1a83e-2e36-4691-b637-3785b895af8c',
      'ONWSD': 'fe2be0b3-2a99-4245-881e-b530e15377f2',
      // add more if needed
    };

async function getStatusChoices(listTitle) {
  let actualListTitle = '';
  if (listTitle === 'ONWCOD') {
    actualListTitle = 'ONWCOD%20Assessment%20Requests';
  } else if (listTitle === 'OFFWCOD&WSD') {
    actualListTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
  } else if (listTitle === 'ONWSD') {
    actualListTitle = 'ONWSD%20Assessment%20Requests';
  } else if (listTitle === 'SAOWCOD') {
    actualListTitle = 'SAOWCOD';
  } else if (listTitle === 'SAGWCOD') {
    actualListTitle = 'SAGWCOD';
  }

  const listUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${actualListTitle}')/fields?$filter=Title eq 'Status'&$select=Choices`;
  try {
    const resp = await fetch(listUrl, { method: 'GET', headers: { 'Accept': 'application/json; odata=verbose' } });
    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`❌ GET Status failed: ${resp.status}`, txt);
      return [];
    }
    const json = await resp.json();
    return json?.d?.results?.[0]?.Choices?.results ?? [];
  } catch (e) {
    console.error(`❌ Exception fetching Status for "${listTitle}":`, e);
    return [];
  }
}

    getStatusChoices(record.ListTitle).then(choices => {
      if (choices.length > 0) {
        const form = document.createElement('div');
        form.className = 'form-group';

        const select = document.createElement('select');
        select.id = 'newStatusSelect';
        choices.forEach(choice => {
          const optionElement = document.createElement('option');
          optionElement.value = choice;
          optionElement.textContent = choice;
          select.appendChild(optionElement);
        });
        form.appendChild(select);

        select.addEventListener('change', () => {
          const newStatus = select.value;

          if (newStatus.toLowerCase().includes("completed") && newStatus.toLowerCase().includes("wcesu")) {
            const attachmentContainer = document.createElement('div');
            attachmentContainer.style.marginTop = '10px';
            form.appendChild(attachmentContainer);

const lorIssueDateLabel = document.createElement('label');
lorIssueDateLabel.textContent = 'LoR Issue Date:';
lorIssueDateLabel.htmlFor = 'lorIssueDateInput';
lorIssueDateLabel.style.display = 'block';
form.appendChild(lorIssueDateLabel);

const lorIssueDateInput = document.createElement('input');
lorIssueDateInput.type = 'date';
lorIssueDateInput.id = 'lorIssueDateInput';
lorIssueDateInput.required = true;
form.appendChild(lorIssueDateInput);

const lorValidityDateLabel = document.createElement('label');
lorValidityDateLabel.textContent = 'LoR Validity Date:';
lorValidityDateLabel.htmlFor = 'lorValidityDateInput';
lorValidityDateLabel.style.display = 'block';
lorValidityDateLabel.style.marginTop = '10px';
form.appendChild(lorValidityDateLabel);

const lorValidityDateInput = document.createElement('input');
lorValidityDateInput.type = 'date';
lorValidityDateInput.id = 'lorValidityDateInput';
lorValidityDateInput.required = true;
form.appendChild(lorValidityDateInput);          

const lorExcelLabel = document.createElement('label');
            lorExcelLabel.textContent = 'LoR Excel:';
            lorExcelLabel.htmlFor = 'lorExcelInput';
            lorExcelLabel.style.display = 'block';
            attachmentContainer.appendChild(lorExcelLabel);

            const lorExcelInput = document.createElement('input');
            lorExcelInput.type = 'file';
            lorExcelInput.id = 'lorExcelInput';
            lorExcelInput.accept = '.xlsx';
            lorExcelInput.required = true;
            attachmentContainer.appendChild(lorExcelInput);

            const lorPdfLabel = document.createElement('label');
            lorPdfLabel.textContent = 'LoR PDF:';
            lorPdfLabel.htmlFor = 'lorPdfInput';
            lorPdfLabel.style.display = 'block';
            lorPdfLabel.style.marginTop = '10px';
            attachmentContainer.appendChild(lorPdfLabel);

            const lorPdfInput = document.createElement('input');
            lorPdfInput.type = 'file';
            lorPdfInput.id = 'lorPdfInput';
            lorPdfInput.accept = '.pdf';
            lorPdfInput.required = true;
            attachmentContainer.appendChild(lorPdfInput);
          } else {
            const attachmentContainer = form.querySelector('div');
            if (attachmentContainer) {
              form.removeChild(attachmentContainer);
            }
          }
        });

        const submitBtn = document.createElement('button');
        submitBtn.id = 'submitBtn';
        submitBtn.textContent = 'Submit Changes';

submitBtn.onclick = async () => {
  const newStatus = document.getElementById('newStatusSelect').value;
  const lorExcelFile = document.getElementById('lorExcelInput') ? document.getElementById('lorExcelInput').files[0] : null;
  const lorPdfFile = document.getElementById('lorPdfInput') ? document.getElementById('lorPdfInput').files[0] : null;
  let lorIssueDateValue = '';
  let lorValidityDateValue = '';

  if (newStatus.toLowerCase().includes("completed") && newStatus.toLowerCase().includes("wcesu")) {
    const lorIssueDateInput = document.getElementById('lorIssueDateInput');
    const lorValidityDateInput = document.getElementById('lorValidityDateInput');

    if (lorIssueDateInput && lorValidityDateInput) {
      lorIssueDateValue = new Date(lorIssueDateInput.value + 'T00:00:00Z').toISOString();
      lorValidityDateValue = new Date(lorValidityDateInput.value + 'T00:00:00Z').toISOString();
    }
  }

          if (lorExcelFile && !lorExcelFile.name.endsWith('.xlsx')) {
            alert('Please upload a valid Excel file (.xlsx) for LoR Excel');
            return;
          }

          if (lorPdfFile && !lorPdfFile.name.endsWith('.pdf')) {
            alert('Please upload a valid PDF file (.pdf) for LoR PDF');
            return;
          }

          if (newStatus.toLowerCase().includes("completed") && newStatus.toLowerCase().includes("wcesu")) {
            if (!lorExcelFile || !lorPdfFile) {
              alert('Please upload necessary paperwork (LoR Excel and LoR PDF)');
              return;
            }
          }

async function updateRecordStatus(record, newListTitle, newStatus, lorExcelFile, lorPdfFile, lorIssueDate, lorValidityDate) {
  try {
    let listTitle = '';
    if (newListTitle === 'ONWCOD') {
      listTitle = 'ONWCOD%20Assessment%20Requests';
    } else if (newListTitle === 'OFFWCOD&WSD') {
      listTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
    } else if (newListTitle === 'ONWSD') {
      listTitle = 'ONWSD%20Assessment%20Requests';
    } else if (newListTitle === 'SAOWCOD') {
      listTitle = 'SAOWCOD';
    } else if (newListTitle === 'SAGWCOD') {
      listTitle = 'SAGWCOD';
    }

    const listUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')`;
    const contextInfoUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/contextinfo`;
    const digestResponse = await fetch(contextInfoUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose'
      }
    });
    const digestData = await digestResponse.json();
    const xRequestDigest = digestData.d.GetContextWebInformation.FormDigestValue;

    const updateUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})`;

    const currentItemResponse = await fetch(updateUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    });
    const currentItem = await currentItemResponse.json();
    const metadataType = currentItem.d.__metadata.type;

    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': 'application/json; odata=verbose',
        'X-HTTP-Method': 'MERGE',
        'If-Match': '*',
        'X-RequestDigest': xRequestDigest
      },
      body: JSON.stringify({
        "__metadata": {
          "type": metadataType
        },
        "Status": newStatus,
        ...(newStatus.toLowerCase().includes("completed") && newStatus.toLowerCase().includes("wcesu")) ? {
          "lorIssueDate": lorIssueDateValue,
          "lorValidityDate": lorValidityDateValue
        } : {}
      })
    });

    if (updateResponse.ok) {
      console.log('Record updated successfully');

      if (lorExcelFile) {
        const excelUploadUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${lorExcelFile.name}')`;
        const excelUploadResponse = await fetch(excelUploadUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json; odata=verbose',
            'Content-Type': lorExcelFile.type,
            'X-RequestDigest': xRequestDigest
          },
          body: lorExcelFile
        });
        if (excelUploadResponse.ok) {
          console.log('LoR Excel file uploaded successfully');
        } else {
          console.error('Error uploading LoR Excel file:', await excelUploadResponse.text());
        }
      }

      if (lorPdfFile) {
        const pdfUploadUrl = `https://sharek.aramco.com.sa/modern/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${lorPdfFile.name}')`;
        const pdfUploadResponse = await fetch(pdfUploadUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json; odata=verbose',
            'Content-Type': lorPdfFile.type,
            'X-RequestDigest': xRequestDigest
          },
          body: lorPdfFile
        });
        if (pdfUploadResponse.ok) {
          console.log('LoR PDF file uploaded successfully');
        } else {
          console.error('Error uploading LoR PDF file:', await pdfUploadResponse.text());
        }
      }

      // Update the cell value dynamically
      const table = document.getElementById('active-requests-table');
      const rows = table.getElementsByTagName('tr');
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('td');
        if (cells.length > 0) {
          const idCell = cells[0];
          if (idCell.textContent === record.record.Id.toString()) {
            const statusCell = cells[3];
            statusCell.innerHTML = `${newStatus} <button class="change-status-button" data-record="${encodeURIComponent(JSON.stringify({ Title: record.Title, ListTitle: record.ListTitle, record: record.record }))}">Change</button>`;
            break;
          }
        }
      }

      dialogueWindow.style.display = 'none';

      alert('Status has been changed successfully');
    } else {
      console.error('Error updating record:', await updateResponse.text());
      alert('Error updating record. Please try again.');
    }
  } catch (error) {
    console.error('Error updating record:', error);
    alert('Error updating record. Please try again.');
  }
}
  await updateRecordStatus(record, record.ListTitle, newStatus, lorExcelFile, lorPdfFile, lorIssueDateValue, lorValidityDateValue);
};
        form.appendChild(submitBtn);

        dialogueContent.appendChild(form);

      } else {
        const message = document.createElement('p');
        message.textContent = 'No status choices available.';
        dialogueContent.appendChild(message);
      }
    });

    dialogueWindow.style.display = 'block';
  } catch (error) {
    console.error('Error processing change status request:', error);
  }
}
    });

    document.getElementById('dialogue-close-2').addEventListener('click', () => {
      document.getElementById('dialogue-window-2').style.display = 'none';
    });
  } catch (error) {
    console.error('Error:', error);
  }
})();