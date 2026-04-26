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

export { renderRecord, calculateStepDuration };