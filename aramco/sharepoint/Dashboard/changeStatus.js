async function updateRecordStatus(record, newListTitle, newStatus, lorExcelFile, lorPdfFile, lorIssueDate, lorValidityDate) {
  try {
    let listTitle = '';
    if (newListTitle === 'ONWCOD Assessment Requests') {
      listTitle = 'ONWCOD%20Assessment%20Requests';
    } else if (newListTitle === 'OFFWCOD&WSD Assessment Requests') {
      listTitle = 'OFFWCOD&WSD%20Assessment%20Requests';
    } else if (newListTitle === 'ONWSD Assessment Requests') {
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
          "lorIssueDate": lorIssueDate,
          "lorValidityDate": lorValidityDate
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
      throw new Error(`Failed to fetch status options: ${resp.status}`);
    }
    const json = await resp.json();
    const statusField = json.d.results[0];
    if (statusField && statusField.Choices) {
      return statusField.Choices.results;
    } else {
      throw new Error('No status choices available');
    }
  } catch (e) {
    console.error(`❌ Exception fetching Status for "${listTitle}":`, e);
    throw new Error(`Failed to fetch status options: ${e.message}`);
  }
}