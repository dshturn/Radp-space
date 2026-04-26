document.addEventListener('click', (e) => {
  if (e.target.classList.contains('change-status-button')) {
    e.preventDefault();
    try {
      const recordString = e.target.dataset.record;
      if (!recordString) {
        console.error('No record string found');
        return;
      }
      try {
        const record = JSON.parse(recordString);
        const dialogueWindow = document.getElementById('dialogue-window-2');
        const dialogueContent = document.getElementById('dialogue-content-2');
        dialogueContent.innerHTML = '';
        const h2 = document.createElement('h2');
        h2.id = 'change-dialogue-title';
        h2.textContent = 'Change Status';
        dialogueContent.appendChild(h2);

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

            const submitBtn = document.createElement('button');
            submitBtn.id = 'submitBtn';
            submitBtn.textContent = 'Submit Changes';

            submitBtn.onclick = async () => {
              const newStatus = document.getElementById('newStatusSelect').value;
              // ...
              await updateRecordStatus(record, record.ListTitle, newStatus);
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
        console.error('Error parsing record string:', error);
      }
    } catch (error) {
      console.error('Error processing change status request:', error);
    }
  }
});

document.getElementById('dialogue-close-2').addEventListener('click', () => {
  document.getElementById('dialogue-window-2').style.display = 'none';
});

async function updateRecordStatus(record, newListTitle, newStatus) {
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
        "Status": newStatus
      })
    });

    if (updateResponse.ok) {
      console.log('Record updated successfully');
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