console.log('JavaScript file loaded');


export function changeStatus(record) {
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

  async function getStatusChoices(listTitle) {
    try {
      const listGuids = {
        'ONWCOD': '0BEA2164-4ADD-45F8-B462-C838F331246C',
        'OFFWCOD&WSD': '1CDF80FC-8319-4D5F-8186-437C9DDB2C7F',
        'ONWSD': '259ACF29-2737-41CB-A8DD-C8692A9AAF1A'
      };
      const listGuid = listGuids[listTitle];
      const listUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')`;
      const fieldUrl = `${listUrl}/fields?$filter=Title eq 'Status'&$select=Choices`;
      const response = await fetch(fieldUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json; odata=verbose'
        }
      });
      const fieldData = await response.json();
      if (fieldData.d.results && fieldData.d.results.length > 0) {
        const choices = fieldData.d.results[0].Choices.results;
        return choices;
      } else {
        console.log(`No "Status" field found in the "${listTitle}" list.`);
        return [];
      }
    } catch (error) {
      console.error('Error getting status choices:', error);
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

        updateRecordStatus(record, record.ListTitle, newStatus, lorExcelFile, lorPdfFile);
      };

      dialogueContent.appendChild(form);
      dialogueContent.appendChild(submitBtn);
      dialogueWindow.style.display = 'block';

      document.getElementById('dialogue-close-2').addEventListener('click', () => {
        dialogueWindow.style.display = 'none';
      });
    } else {
      console.log(`No status choices found for the "${record.ListTitle}" list.`);
    }
  });
}