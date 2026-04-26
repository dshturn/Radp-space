async function updateRecordStatus(record, newListTitle, newStatus, lorExcelFile, lorPdfFile, lorIssueDate, lorValidityDate, dialogueWindow) {
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
          "lorIssueDate": lorIssueDate,
          "lorValidityDate": lorValidityDate
        } : {}
      })
    });

    if (updateResponse.ok) {
      console.log('Record updated successfully');

      if (lorExcelFile) {
        try {
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
        } catch (error) {
          console.error('Error uploading LoR Excel file:', error);
        }
      }

      if (lorPdfFile) {
        try {
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
        } catch (error) {
          console.error('Error uploading LoR PDF file:', error);
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
    }
  } catch (error) {
    console.error('Error updating record:', error);
  }
}

export { updateRecordStatus };