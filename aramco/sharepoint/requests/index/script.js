console.log('Script loaded');

(async () => {
  try {
    const script = document.createElement('script');
    script.src = '/_layouts/15/SP.Runtime.js';
    script.type = 'text/javascript';
    document.head.appendChild(script);
    script.onload = async () => {
      if (typeof SP !== 'undefined') {
        console.log('SP object is defined');
        SP.UI.Notify.addNotification('Loading SharePoint JavaScript library...');
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

          const data = await Promise.all(urls.map(async (url) => {
            try {
              const response = await fetch(url, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json; odata=verbose'
                }
              });
              return await response.json();
            } catch (error) {
              console.error('Error fetching data:', error);
              return null;
            }
          }));

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

          activeRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
          completedRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
          onwcodRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
          offwcodwsdRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));
          onwsdRecords.sort((a, b) => new Date(b.record.Modified) - new Date(a.record.Modified));

          const activeRecordsCount = activeRecords.length;
          const completedRecordsCount = completedRecords.length;
          const onwcodRecordsCount = onwcodRecords.length;
          const offwcodwsdRecordsCount = offwcodwsdRecords.length;
          const onwsdRecordsCount = onwsdRecords.length;

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
          `;

          const preloadedData = {
            'Active Requests': await Promise.all(activeRecords.map(async (record) => {
              try {
                return await renderRecord(record, 'Active Requests');
              } catch (error) {
                console.error('Error rendering record:', error);
                return null;
              }
            })),
            'Completed Requests': await Promise.all(completedRecords.map(async (record) => {
              try {
                return await renderRecord(record, 'Completed Requests');
              } catch (error) {
                console.error('Error rendering record:', error);
                return null;
              }
            })),
            'ONWCOD': await Promise.all(onwcodRecords.map(async (record) => {
              try {
                return await renderRecord(record, 'ONWCOD');
              } catch (error) {
                console.error('Error rendering record:', error);
                return null;
              }
            })),
            'OFFWCOD&WSD': await Promise.all(offwcodwsdRecords.map(async (record) => {
              try {
                return await renderRecord(record, 'OFFWCOD&WSD');
              } catch (error) {
                console.error('Error rendering record:', error);
                return null;
              }
            })),
            'ONWSD': await Promise.all(onwsdRecords.map(async (record) => {
              try {
                return await renderRecord(record, 'ONWSD');
              } catch (error) {
                console.error('Error rendering record:', error);
                return null;
              }
            }))
          };

          document.getElementById('loading-screen').style.display = 'none';
          document.getElementById('container').style.display = 'flex';

          renderActiveRequests(preloadedData['Active Requests'], 'Active Requests');

          document.getElementById('refresh-button').addEventListener('click', async () => {
            try {
              await refreshData();
            } catch (error) {
              console.error('Error refreshing data:', error);
            }
          });

          document.addEventListener('click', async (e) => {
            if (e.target.classList.contains('tile') || e.target.parentNode.classList.contains('tile')) {
              const tiles = document.querySelectorAll('.tile');
              tiles.forEach((tile) => {
                tile.classList.remove('active');
              });
              const tile = e.target.classList.contains('tile') ? e.target : e.target.parentNode;
              tile.classList.add('active');
              const index = tile.dataset.index;
              const name = tile.dataset.name;
              try {
                await renderActiveRequests(preloadedData[name], name);
              } catch (error) {
                console.error('Error rendering active requests:', error);
              }
            } else if (e.target.classList.contains('request-title')) {
              e.preventDefault();
              try {
                const recordString = decodeURIComponent(e.target.dataset.record);
                const record = JSON.parse(recordString);
                await displayVersioningInfo(record);
              } catch (error) {
                console.error('Error displaying versioning info:', error);
              }
            } else if (e.target.classList.contains('change-status-button')) {
              e.preventDefault();
              try {
                const recordString = decodeURIComponent(e.target.dataset.record);
                const record = JSON.parse(recordString);
                await changeStatus(record);
              } catch (error) {
                console.error('Error changing status:', error);
              }
            }
          });

          initializeDataTables();
        } catch (error) {
          console.error('Error loading SharePoint JavaScript library:', error);
        }
      } else {
        console.error('SP object is not defined');
      }
    };
  } catch (error) {
    console.error('Error loading script:', error);
  }
})();

async function renderRecord(record, type) {
  try {
    const modifiedTime = new Date(record.record.Modified);
    const stepDuration = calculateStepDuration(modifiedTime);
    const editorId = record.record.EditorId;
    const apiUrl = `https://sharek.aramco.com.sa/_api/web/siteusers/getbyid(${editorId})`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    });
    const data = await response.json();
    const editorName = data.d.Title;
    const recordString = JSON.stringify({ Title: record.Title, ListTitle: record.ListTitle, record: record.record });

    let listTitle = '';
    if (record.ListTitle === 'ONWCOD') {
      listTitle = 'ONWCOD%20Assessment%20Requests';
    } else if (record.ListTitle === 'OFFWCOD&WSD') {
      listTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
    } else if (record.ListTitle === 'ONWSD') {
      listTitle = 'ONWSD%20Assessment%20Requests';
    }

    const url = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/versions?$select=UniqueId,VersionId,Modified,Editor/Id,Editor/Name,Status&$expand=Editor`;
    const response2 = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    });
    const data2 = await response2.json();
    const versionHistory = [];
    for (var j = 0; j < data2.d.results.length; j++) {
      var version = data2.d.results[j];
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
  } catch (error) {
    console.error('Error rendering record:', error);
    return null;
  }
}

function calculateStepDuration(modifiedTime) {
  const currentTime = new Date();
  const duration = currentTime - modifiedTime;
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));
  return `${days} days`;
}

async function renderActiveRequests(records, type) {
  try {
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
    $.fn.dataTable.ext.order['duration'] = function (settings, col) {
      return this.api().column(col, { order: 'index' }).nodes().map(function (td, i) {
        var val = $(td).text().replace(/[^0-9]/g, '');
        return parseInt(val);
      });
    };
  } catch (error) {
    console.error('Error rendering active requests:', error);
  }
}

async function refreshData() {
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

    const data = await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json; odata=verbose'
          }
        });
        return await response.json();
      } catch (error) {
        console.error('Error fetching data:', error);
        return null;
      }
    }));

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
      recordsToRender.map(async (record) => {
        try {
          return await renderRecord(record, currentTabName);
        } catch (error) {
          console.error('Error rendering record:', error);
          return null;
        }
      })
    );

    await renderActiveRequests(preloadedRecords, currentTabName);
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
}

function initializeDataTables() {
  // Initialize DataTables
  if (document.getElementById('active-requests-table')) {
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
  }

  if (document.getElementById('completed-requests-table')) {
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
  }

  if (document.getElementById('onwcod-requests-table')) {
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
  }

  if (document.getElementById('offwcodwsd-requests-table')) {
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
  }

  if (document.getElementById('onwsd-requests-table')) {
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
  $.fn.dataTable.ext.order['duration'] = function (settings, col) {
    return this.api().column(col, { order: 'index' }).nodes().map(function (td, i) {
      var val = $(td).text().replace(/[^0-9]/g, '');
      return parseInt(val);
    });
  };
}