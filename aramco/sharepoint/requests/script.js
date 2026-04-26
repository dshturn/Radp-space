import { fetchData } from './fetchData.js';
import { renderRecord } from './renderRecord.js';
import { renderActiveRequests } from './renderActiveRequests.js';
import { displayVersioningInfo } from './displayVersioningInfo.js';
import { updateRecordStatus } from './changeStatus.js';

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
      } else if (e.target.classList.contains('change-status-button')) {
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

  await updateRecordStatus(record, record.ListTitle, newStatus, lorExcelFile, lorPdfFile, lorIssueDateValue, lorValidityDateValue, dialogueWindow);
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