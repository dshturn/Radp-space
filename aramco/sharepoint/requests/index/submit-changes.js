console.log('JavaScript file loaded');


export function submitChanges(record, newListTitle, newStatus, lorExcelFile, lorPdfFile) {
  async function updateRecordStatus(record, newListTitle, newStatus, lorExcelFile, lorPdfFile) {
    try {
      const listGuids = {
        'ONWCOD': '0BEA2164-4ADD-45F8-B462-C838F331246C',
        'OFFWCOD&WSD': '1CDF80FC-8319-4D5F-8186-437C9DDB2C7F',
        'ONWSD': '259ACF29-2737-41CB-A8DD-C8692A9AAF1A'
      };
      const listGuid = listGuids[newListTitle];
      const listUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')`;
      const contextInfoUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/contextinfo`;
      const digestResponse = await fetch(contextInfoUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json; odata=verbose',
          'Content-Type': 'application/json; odata=verbose'
        }
      });
      const digestData = await digestResponse.json();
      const xRequestDigest = digestData.d.GetContextWebInformation.FormDigestValue;

      const updateUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')/items(${record.record.Id})`;

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
          "Status": newStatus
        })
      });

      if (updateResponse.ok) {
        console.log('Record updated successfully');

        if (lorExcelFile) {
          const excelUploadUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${lorExcelFile.name}')`;
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
          const pdfUploadUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${lorPdfFile.name}')`;
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
      } else {
        console.error('Error updating record:', await updateResponse.text());
      }
    } catch (error) {
      console.error('Error updating record status:', error);
    }
  }

  updateRecordStatus(record, newListTitle, newStatus, lorExcelFile, lorPdfFile);
}