console.log('JavaScript file loaded');


export async function uploadFile(file, record, newListTitle) {
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

    const uploadUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${file.name}')`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': file.type,
        'X-RequestDigest': xRequestDigest
      },
      body: file
    });

    if (uploadResponse.ok) {
      console.log(`File ${file.name} uploaded successfully`);
      return true;
    } else {
      console.error(`Error uploading file ${file.name}:`, await uploadResponse.text());
      return false;
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    return false;
  }
}

export async function uploadLoRExcelFile(file, record, newListTitle) {
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

    const uploadUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${file.name}')`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': file.type,
        'X-RequestDigest': xRequestDigest
      },
      body: file
    });

    if (uploadResponse.ok) {
      console.log(`LoR Excel file ${file.name} uploaded successfully`);
      return true;
    } else {
      console.error(`Error uploading LoR Excel file ${file.name}:`, await uploadResponse.text());
      return false;
    }
  } catch (error) {
    console.error('Error uploading LoR Excel file:', error);
    return false;
  }
}

export async function uploadLoRPdfFile(file, record, newListTitle) {
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

    const uploadUrl = `https://sharek.aramco.com.sa/orgs/30002972/30037952/_api/web/lists(guid'${listGuid}')/items(${record.record.Id})/AttachmentFiles/add(FileName='${file.name}')`;
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'Content-Type': file.type,
        'X-RequestDigest': xRequestDigest
      },
      body: file
    });

    if (uploadResponse.ok) {
      console.log(`LoR PDF file ${file.name} uploaded successfully`);
      return true;
    } else {
      console.error(`Error uploading LoR PDF file ${file.name}:`, await uploadResponse.text());
      return false;
    }
  } catch (error) {
    console.error('Error uploading LoR PDF file:', error);
    return false;
  }
}