console.log('JavaScript file loaded');


export async function getRequestInfo(record) {
  try {
    let listTitle = '';
    if (record.ListTitle === 'ONWCOD') {
      listTitle = 'ONWCOD%20Assessment%20Requests';
    } else if (record.ListTitle === 'OFFWCOD&WSD') {
      listTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
    } else if (record.ListTitle === 'ONWSD') {
      listTitle = 'ONWSD%20Assessment%20Requests';
    }

    const requestInfoUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})?$select=Created,Title,Service_x0020_Provider,Service_x0020_Type,FileLeafRef`;
    const response = await fetch(requestInfoUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const requestInfo = await response.json();
    return requestInfo.d;
  } catch (error) {
    console.error('Error getting request info:', error);
    return null;
  }
}

export function renderRequestInfo(requestInfo) {
  if (!requestInfo) {
    return;
  }

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
  createdByValueCell.textContent = 'Unknown'; // Replace with actual created by value
  createdByRow.appendChild(createdByValueCell);

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
  divisionValueCell.textContent = 'Unknown'; // Replace with actual division value
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

  return requestInfoTable;
}

export async function getAttachmentFiles(record) {
  try {
    let listTitle = '';
    if (record.ListTitle === 'ONWCOD') {
      listTitle = 'ONWCOD%20Assessment%20Requests';
    } else if (record.ListTitle === 'OFFWCOD&WSD') {
      listTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
    } else if (record.ListTitle === 'ONWSD') {
      listTitle = 'ONWSD%20Assessment%20Requests';
    }

    const attachmentUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists/GetByTitle('${listTitle}')/items(${record.record.Id})/AttachmentFiles`;
    const response = await fetch(attachmentUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json; odata=verbose'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const attachmentData = await response.json();
    return attachmentData.d.results;
  } catch (error) {
    console.error('Error getting attachment files:', error);
    return null;
  }
}