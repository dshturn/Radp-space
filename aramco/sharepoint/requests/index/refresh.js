console.log('JavaScript file loaded');


export async function refreshData() {
  try {
    const urls = [
      'https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle(\'ONWCOD Assessment Requests\')/items',
      'https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle(\'OFFWCOD&WSD Assessment Requests\')/items',
      'https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle(\'ONWSD Assessment Requests\')/items'
    ];
    const listNames = ['ONWCOD', 'OFFWCOD&WSD', 'ONWSD'];
    const listGuids = {
      'ONWCOD': '0BEA2164-4ADD-45F8-B462-C838F331246C',
      'OFFWCOD&WSD': '1CDF80FC-8319-4D5F-8186-437C9DDB2C7F',
      'ONWSD': '259ACF29-2737-41CB-A8DD-C8692A9AAF1A'
    };

    const data = await Promise.all(urls.map(fetchData));

    const allData = data.reduce((acc, item, index) => {
      item.d.results.forEach(record => {
        acc.push({ record, listIndex: index });
      });
      return acc;
    }, []);

    allData.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));

    const currentTabName = document.querySelector('.tile.active')?.dataset?.name || 'Active Requests';

    let recordsToRender;
    if (currentTabName === 'Active Requests') {
      recordsToRender = allData.filter((item) => {
        return !item.record.Status || !item.record.Status.toLowerCase().includes('completed');
      }).map((item) => ({
        Title: item.record.Title,
        ListTitle: listNames[item.listIndex],
        record: item.record
      }));
    } else if (currentTabName === 'Completed Requests') {
      recordsToRender = allData.filter((item) => {
        return item.record.Status && item.record.Status.toLowerCase().includes('completed');
      }).map((item) => ({
        Title: item.record.Title,
        ListTitle: listNames[item.listIndex],
        record: item.record
      }));
    } else {
      const matchedList = listNames.find(name => name === currentTabName);
      if (matchedList) {
        recordsToRender = allData.filter((item) => listNames[item.listIndex] === matchedList)
          .map((item) => ({
            Title: item.record.Title,
            ListTitle: listNames[item.listIndex],
            record: item.record
          }));
      }
    }

    recordsToRender.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));

    const preloadedRecords = await Promise.all(
      recordsToRender.map(item => renderRecord(item, currentTabName))
    );

    renderActiveRequests(preloadedRecords, currentTabName);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function fetchData(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    });
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
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
      }

      const url = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/versions?$select=UniqueId,VersionId,Modified,Editor/Id,Editor/Name,Status&$expand=Editor`;
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
            const modifiedBy = version.Editor ? version.Editor.LookupValue : 'Unknown';
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
                <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
                <td>${record.ListTitle}</td>
                <td>${record.record.Status || 'Pending'} <button class="change-status-button" data-record="${encodeURIComponent(recordString)}">Change</button></td>
                <td style="background-color: ${stepBackgroundColor}">${days}</td>
                <td style="background-color: ${backgroundColor}">${requestDuration}</td>
                <td>${formattedCreatedDate}</td>
                <td>${formattedModifiedDate}</td>
              </tr>
            `;
          } else if (type === 'Completed Requests') {
            return `
              <tr>
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
                <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
                <td>${record.ListTitle}</td>
                <td>${record.record.Status || 'Pending'} <button class="change-status-button" data-record="${encodeURIComponent(recordString)}">Change</button></td>
                <td style="background-color: ${stepBackgroundColor}">${days}</td>
                <td style="background-color: ${backgroundColor}">${requestDuration}</td>
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
            <td><a href="#" class="request-title" data-record="${encodeURIComponent(recordString)}">${record.Title}</a></td>
            <td>${record.ListTitle}</td>
            <td>${record.record.Status || 'Pending'} <button class="change-status-button" data-record="${encodeURIComponent(recordString)}">Change</button></td>
            <td style="background-color: ${stepBackgroundColor}">${days}</td>
            <td style="background-color: ${backgroundColor}">${requestDuration}</td>
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
    document.getElementById('active-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('active-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#active-requests-table thead tr').innerHTML = `
      <th>Title</th>
      <th>Division</th>
      <th>Current Status</th>
      <th>Step Duration, Days</th>
      <th>Request Duration, Days</th>
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
    document.getElementById('completed-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('completed-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#completed-requests-table thead tr').innerHTML = `
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
    document.getElementById('onwcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('onwcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#onwcod-requests-table thead tr').innerHTML = `
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
    document.getElementById('offwcodwsd-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('offwcodwsd-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#offwcodwsd-requests-table thead tr').innerHTML = `
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
    document.getElementById('onwsd-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('onwsd-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#onwsd-requests-table thead tr').innerHTML = `
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
          "targets": [3, 4],
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
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
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
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
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
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
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
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
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
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