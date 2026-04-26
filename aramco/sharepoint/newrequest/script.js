let listName;                     // set by the division <select>
let currentList = null;           // holds the SP List object for goToList()

/*=====================================================================
  Helper functions – unchanged + new ones from the HTML snippet
=====================================================================*/
function getFieldInternalName(columns, fieldId) {
  for (let i = 0; i < columns.get_count(); i++) {
    const col = columns.getItemAtIndex(i);
    if (col.get_internalName() === fieldId) return col.get_internalName();
  }
  return null;
}

/* Get internal name by **title** (display name) */
function getFieldInternalNameByTitle(columns, fieldTitle) {
  for (let i = 0; i < columns.get_count(); i++) {
    const col = columns.getItemAtIndex(i);
    if (col.get_title() === fieldTitle) return col.get_internalName();
  }
  return null;
}

/* Get the column title from an internal name (debug only) */
function getFieldTitle(columns, fieldId) {
  for (let i = 0; i < columns.get_count(); i++) {
    const col = columns.getItemAtIndex(i);
    if (col.get_internalName() === fieldId) return col.get_title();
  }
  return null;
}

/*=====================================================================
  List selection – unchanged (just calls createListItem)
=====================================================================*/
function selectList(value) {
  listName = value;
  createListItem();
}

/* Initialise on page load – the default option is already selected */
$(document).ready(function () {
  selectList(document.getElementById("listSelect").value);
});

/*=====================================================================
  Dynamic form rendering
=====================================================================*/
function generateFormHtml(columns) {
  let formHtml = "";
  for (let i = 0; i < columns.get_count(); i++) {
    const col = columns.getItemAtIndex(i);
    const colName = col.get_title();
    const colInternal = col.get_internalName();
    const colType = col.get_typeAsString();

    // hide system / read‑only columns
    if (
      col.get_hidden() ||
      col.get_sealed() ||
      [
        "Compliance Asset Id",
        "lorValidityDate",
        "lorIssueDate",
        "Modified",
        "Created",
        "Version",
        "Status",
        "Link",
        "Division",
        "Comments",
        "Title",
        "Aramco Cloud Link",
        "Service Provider's Focal Point (email, mobile)",
        "LoR Validity Date"
      ].includes(colName)
    ) {
      continue;
    }

    // -----------------------------------------------------------------
    // Simple field types (Text, Choice, Boolean, DateTime)
    // -----------------------------------------------------------------
    if (["Text", "Choice", "Boolean", "DateTime"].includes(colType)) {
      const title = colName === "Title" ? "Request Title" : colName;
      switch (colType) {
        case "Text":
          formHtml += `<div class="form-group"><label>${title}</label><input type="text" id="${colInternal}"></div>`;
          break;
        case "Choice":
          formHtml += `<div class="form-group"><label>${title}</label><select id="${colInternal}">`;
          const choices = col.get_choices();
          if (choices) {
            for (let j = 0; j < choices.length; j++) {
              formHtml += `<option value="${choices[j]}">${choices[j]}</option>`;
            }
          }
          formHtml += `</select></div>`;
          break;
        case "Boolean":
          formHtml += `<div class="form-group"><label>${title}</label><input type="checkbox" id="${colInternal}"></div>`;
          break;
        case "DateTime":
          formHtml += `<div class="form-group"><label>${title}</label><input type="date" id="${colInternal}"></div>`;
          break;
      }
    }
    // -----------------------------------------------------------------
    // MultiChoice – rendered as a list of check‑boxes
    // -----------------------------------------------------------------
    else if (colType === "MultiChoice") {
      formHtml += `<div class="form-group"><label>${colName}</label>`;
      const multiChoices = col.get_choices();
      if (multiChoices) {
        for (let k = 0; k < multiChoices.length; k++) {
          formHtml += `<input type="checkbox" name="${colInternal}" id="${colInternal}_${k}" value="${multiChoices[k]}">${multiChoices[k]}<br>`;
        }
      }
      formHtml += `</div>`;
    }
  }

  // -----------------------------------------------------------------
  // Extra fields that are not part of the SharePoint schema
  // -----------------------------------------------------------------
  formHtml += `<div class="form-group"><label>Service Provider's Focal Point (email, mobile)</label><input type="text" id="Service_x0020_Provider_x0027_s_x0020_Focal_x0020_Point"></div>`;

  // Attachment field – hidden initially, will be shown by updateAttachmentField()
  formHtml += `<div class="form-group" id="attachmentField" style="display:none;"><label>Well Programs</label><input type="file" id="fileInput" multiple></div>`;

  // Submit button
  formHtml += `<div class="form-group"><button class="submit-button" onclick="submitAndOpenEmail(event)">Generate Record and Open Email</button></div>`;

  return formHtml;
}

/*=====================================================================
  Create the form for the selected list
=====================================================================*/
function createListItem() {
  if (!listName) {
    console.log("List URL is not set");
    return;
  }

  SP.SOD.executeFunc("sp.js", "SP.ClientContext", function () {
    const ctx = SP.ClientContext.get_current();
    const web = ctx.get_web();
    const lists = web.get_lists();

    ctx.load(lists, "Include(DefaultViewUrl)");
    ctx.executeQueryAsync(
      function () {
        const enumerator = lists.getEnumerator();
        while (enumerator.moveNext()) {
          const list = enumerator.get_current();
          if (list.get_defaultViewUrl().indexOf(listName) !== -1) {
            const columns = list.get_fields();
            ctx.load(columns);
            ctx.executeQueryAsync(
              function () {
                const formHtml = generateFormHtml(columns);
                $("#formContainer").html(formHtml);

                // Hook the Assessment Type change to show/hide the attachment field
                const assessmentSelect = document.getElementById("Assessment_x0020_Type");
                if (assessmentSelect) {
                  assessmentSelect.addEventListener("change", function () {
                    updateAttachmentField(this.value);
                  });
                  updateAttachmentField(assessmentSelect.value);
                }

                // Store the list object for later navigation (goToList)
                window.currentList = list;
              },
              function (sender, args) {
                alert("Error loading list columns: " + args.get_message());
              }
            );
            return; // stop enumerating
          }
        }
        alert("List not found");
      },
      function (sender, args) {
        alert("Error retrieving lists: " + args.get_message());
      }
    );
  });
}

/*=====================================================================
  Attachment field visibility – based on “Full Set”
=====================================================================*/
window.updateAttachmentField = function (value) {
  const attachmentField = document.getElementById("attachmentField");
  if (!attachmentField) return;

  if (value.trim().toLowerCase() === "full set") {
    attachmentField.style.display = "block";
    attachmentField.querySelector("label").textContent = "Well Programs (mandatory)";
  } else {
    attachmentField.style.display = "block";
    attachmentField.querySelector("label").textContent = "Well Programs (optional)";
  }
};

/*=====================================================================
  Title generation – new helper (merged from the HTML snippet)
=====================================================================*/
function buildTitle() {
  let listNameText = "";
  switch (listName) {
    case "offlist":   listNameText = "OFFWCOD&WSD"; break;
    case "onlist":    listNameText = "ONWCOD";      break;
    case "onwsdlist": listNameText = "ONWSD";       break;
  }

  const assessment = document.getElementById("Assessment_x0020_Type")?.value?.trim() || "";
  const serviceProvider = document.getElementById("Service_x0020_Provider")?.value?.trim() || "";

  // Service Type (checkboxes or single select)
  let serviceTypeText = "";
  const serviceTypeCheckboxes = document.getElementsByName("Service_x0020_Type");
  if (serviceTypeCheckboxes && serviceTypeCheckboxes.length) {
    const checked = [];
    for (let i = 0; i < serviceTypeCheckboxes.length; i++) {
      if (serviceTypeCheckboxes[i].checked) checked.push(serviceTypeCheckboxes[i].value);
    }
    if (checked.length) serviceTypeText = checked.join(", ");
  } else {
    const serviceTypeSelect = document.getElementById("Service_x0020_Type");
    if (serviceTypeSelect) serviceTypeText = serviceTypeSelect.value;
  }

  // Destination (checkboxes or single select)
  let destinationText = "";
  const destinationCheckboxes = document.getElementsByName("Destination");
  if (destinationCheckboxes && destinationCheckboxes.length) {
    const checked = [];
    for (let i = 0; i < destinationCheckboxes.length; i++) {
      if (destinationCheckboxes[i].checked) checked.push(destinationCheckboxes[i].value);
    }
    if (checked.length) destinationText = checked.join(", ");
  } else {
    const destinationSelect = document.getElementById("Destination");
    if (destinationSelect) destinationText = destinationSelect.value;
  }

  const parts = [
    assessment,
    "Assessment of",
    serviceProvider,
    serviceTypeText,
    "Equipment for",
    destinationText
  ].filter(p => p && p.trim().length > 0);

  return { titleText: parts.join(" "), listNameText };
}

/*=====================================================================
  Utility – get checked values from a NodeList of check‑boxes
=====================================================================*/
function getCheckedValues(checkboxes) {
  const values = [];
  for (let i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) values.push(checkboxes[i].value);
  }
  return values.join(", ");
}

/*=====================================================================
  Read‑only columns list
=====================================================================*/
const readOnlyFields = [
  "Created",
  "Created_x0020_Date",
  "Modified",
  "Modified_x0020_Date",
  "Author",
  "Editor",
  "ID",
  "Version",
  "ContentTypeId",
  "Attachments"
];

/*=====================================================================
  Safe setter – only writes when we have a valid internal name and the
  column is **not** read‑only.
=====================================================================*/
function safeSetItem(item, internalName, value) {
  if (!internalName) {
    console.warn(`Skipping field – internal name not resolved (value: ${value})`);
    return;
  }
  if (readOnlyFields.includes(internalName)) {
    console.warn(`Skipping read‑only field "${internalName}"`);
    return;
  }
  console.log(`Setting field "${internalName}" =`, value);
  item.set_item(internalName, value);
}

/*=====================================================================
  Helper for true MultiChoice columns – store a CSV string.
=====================================================================*/
function setMultiChoice(item, internalName, csvString) {
  if (!csvString) return;
  safeSetItem(item, internalName, csvString);
}

/*=====================================================================
  X‑RequestDigest helper (now receives a site URL)
=====================================================================*/
async function getXRequestDigest(siteUrl) {
  const contextInfoUrl = `${siteUrl}/_api/contextinfo`;
  try {
    const response = await fetch(contextInfoUrl, {
      method: "POST",
      headers: {
        Accept: "application/json;odata=verbose",
        "Content-Type": "application/json;odata=verbose"
      },
      credentials: "same-origin"
    });
    if (!response.ok) {
      console.error("Error getting FormDigest:", response.status, response.statusText);
      return undefined;
    }
    const data = await response.json();
    return data.d.GetContextWebInformation.FormDigestValue;
  } catch (e) {
    console.error("Exception while getting FormDigest:", e);
    return undefined;
  }
}

/*=====================================================================
  Attachment upload (async) – **fixed**
=====================================================================*/
async function addAttachments(siteUrl, listTitle, itemId, files) {
  // 1️⃣ Get a fresh FormDigest (required for every POST)
  const formDigest = await getXRequestDigest(siteUrl);
  if (!formDigest) {
    console.error("❌ Could not obtain FormDigest – aborting attachment upload");
    return;
  }

  // Helper to upload a single file
  const uploadOne = async file => {
    const encodedFileName = encodeURIComponent(file.name);
    const endpoint = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(
      listTitle
    )}')/items(${itemId})/AttachmentFiles/add(FileName='${encodedFileName}')`;

    const headers = {
      Accept: "application/json;odata=verbose",
      "Content-Type": "application/octet-stream",
      "X-RequestDigest": formDigest
    };

    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: file,
        credentials: "same-origin" // send auth cookies
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(
          `❌ Upload failed for "${file.name}" – ${resp.status} ${resp.statusText}`,
          errBody
        );
        throw new Error(`Upload failed (${resp.status})`);
      }

      const json = await resp.json();
      console.log(`✅ Uploaded "${file.name}" – attachment ID:`, json.d.Id);
    } catch (e) {
      console.error(`❌ Exception while uploading "${file.name}"`, e);
      throw e; // bubble up so the caller can decide what to do
    }
  };

  // Upload sequentially (easier to debug; change to Promise.all for parallel)
  for (const file of files) {
    await uploadOne(file);
  }
}

/*=====================================================================
  Submit handler – merged version (uses the helpers above)
=====================================================================*/
function submitAndOpenEmail(event) {
  event.preventDefault();

  // ---- 1️⃣ Grab controls -------------------------------------------------
  const assessmentSelect   = document.getElementById("Assessment_x0020_Type");
  const serviceProviderSelect = document.getElementById("Service_x0020_Provider");
  const serviceTypeSelect = document.getElementById("Service_x0020_Type");
  const fileInput          = document.getElementById("fileInput");
  const focalPointInput    = document.getElementById("Service_x0020_Provider_x0027_s_x0020_Focal_x0020_Point");

  // ---- 2️⃣ Basic validation ---------------------------------------------
  if (!assessmentSelect?.value) { 
    alert("Please select an assessment type"); 
    return; 
  }
  if (!serviceProviderSelect?.value) { 
    alert("Please select a service provider"); 
    return; 
  }
  if (!serviceTypeSelect?.value) {
    alert("Please select a service type"); 
    return;
  }
  if (!focalPointInput?.value) {
    alert("Please enter the Service Provider's Focal Point (email or mobile)"); 
    return;
  } else {
    const emailRegex  = /^\s*(?:[^<]*<)?\s*([^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)\s*>?\s*$/;
    const mobileRegex = /^\d{10}$/;
    if (!emailRegex.test(focalPointInput.value) && !mobileRegex.test(focalPointInput.value)) {
      alert("Please enter a valid email or a 10‑digit mobile number for the focal point");
      return;
    }
  }
  if (assessmentSelect.value.trim().toLowerCase() === "full set" && fileInput.files.length === 0) {
    alert("Please upload Well Programs (mandatory)"); 
    return;
  }

  // Check if Destination is selected
  const destinationSelect = document.getElementById("Destination");
  const destinationCheckboxes = document.getElementsByName("Destination");
  if ((!destinationSelect || !destinationSelect.value) && (!destinationCheckboxes || !Array.from(destinationCheckboxes).some(cb => cb.checked))) {
    alert("Please select a destination"); 
    return;
  }

  // ---- 3️⃣ Build the Title -----------------------------------------------
  const { titleText, listNameText } = buildTitle();

  // ---- 4️⃣ Choose the correct SharePoint list ----------------------------
  let listTitle = "";
  switch (listName) {
    case "offlist":   listTitle = "OFFWCOD&WSD Assessment Requests"; break;
    case "onlist":    listTitle = "ONWCOD Assessment Requests";      break;
    case "onwsdlist": listTitle = "ONWSD Assessment Requests";       break;
  }

  // ---- 5️⃣ SharePoint create‑item flow ------------------------------------
  SP.SOD.executeFunc("sp.js", "SP.ClientContext", function () {
    const ctx   = SP.ClientContext.get_current();
    const web   = ctx.get_web();
    const list  = web.get_lists().getByTitle(listTitle);
    const cols  = list.get_fields();

    ctx.load(cols);
    ctx.executeQueryAsync(
      // ----- success: columns loaded --------------------------------------
      function () {
        // Resolve internal names once, up‑front
        const assessmentInternal   = getFieldInternalNameByTitle(cols, "Assessment Type");
        const providerInternal     = getFieldInternalNameByTitle(cols, "Service Provider");
        const serviceTypeInternal  = getFieldInternalNameByTitle(cols, "Service Type");
        const destinationInternal  = getFieldInternalNameByTitle(cols, "Destination");
        const focalPointInternal   = getFieldInternalNameByTitle(cols, "Service Provider's Focal Point (email, mobile)");
        const titleInternal        = getFieldInternalNameByTitle(cols, "Title");

        // Create the item
        const itemInfo = new SP.ListItemCreationInformation();
        const item     = list.addItem(itemInfo);

        // ---- mandatory fields ---------------------------------------------
        safeSetItem(item, titleInternal, titleText);
        safeSetItem(item, assessmentInternal, assessmentSelect.value);
        safeSetItem(item, providerInternal,   serviceProviderSelect.value);

        // ---- Service Type (Single Choice) -----------------------------
        safeSetItem(item, serviceTypeInternal, serviceTypeSelect.value);

        // ---- Destination (single select OR MultiChoice) --------------------
        const destinationValues = [];

        // 1) Single‑select <select id="Destination">
        const destSelect = document.getElementById("Destination");
        if (destSelect && destSelect.value) destinationValues.push(destSelect.value);

        // 2) Multi‑choice check‑boxes (name = internal name)
        if (destinationInternal) {
          const destCheckboxes = document.getElementsByName(destinationInternal);
          for (let i = 0; i < destCheckboxes.length; i++) {
            if (destCheckboxes[i].checked) destinationValues.push(destCheckboxes[i].value);
          }
        }

        if (destinationValues.length) {
          safeSetItem(item, destinationInternal, destinationValues.join(","));
        }

        // ---- Service Provider focal point ---------------------------------
        safeSetItem(item, focalPointInternal, focalPointInput?.value);

        // ---- Any extra free‑form text fields -------------------------------
        const extraFields = document.querySelectorAll(".form-group input[type='text']");
        extraFields.forEach(f => {
          if (f.id !== focalPointInput.id && f.value) {
            const internal = getFieldInternalName(cols, f.id);
            if (internal) safeSetItem(item, internal, f.value);
          }
        });

        // ---- Save the item -------------------------------------------------
        item.update();
        ctx.load(item);
        ctx.executeQueryAsync(
          // ----- success: item created ------------------------------------
          function () {
            const itemId = item.get_id();
            console.log("✅ Item created – ID:", itemId);

            // ----- 6️⃣ Upload attachments (if any) -------------------------
            const files = fileInput.files;

            // Use the full sub‑site URL for the REST calls
            const siteUrl = _spPageContextInfo
              ? _spPageContextInfo.webAbsoluteUrl
              : "https://sharek.aramco.com.sa/modern/30037952";

            addAttachments(siteUrl, listTitle, itemId, files)
              .then(() => {
                // ----- 7️⃣ Build and fire the mailto link -----------------
                const cc = [];
                switch (listName) {
                  case "onlist":
                    cc.push("30037971.NAWCODESUDOCUMENTASSESSMENTGROUP@Exchange.Aramco.com.sa", "DS.30037952.NAWCODSAFETYTEAM@Exchange.Aramco.com.sa", "DS.30037958.NAWCODONWCODCOORDINATORS@Exchange.Aramco.com.sa");
                    break;
                  case "offlist":
                    cc.push("30037971.NAWCODESUDOCUMENTASSESSMENTGROUP@Exchange.Aramco.com.sa", "DS.30037952.NAWCODSAFETYTEAM@Exchange.Aramco.com.sa", "DS.30012226.NAWCODOFFWSDCOORDINATORS@Exchange.Aramco.com.sa");
                    break;
                  case "onwsdlist":
                    cc.push("30037971.NAWCODESUDOCUMENTASSESSMENTGROUP@Exchange.Aramco.com.sa", "DS.30037952.NAWCODSAFETYTEAM@Exchange.Aramco.com.sa", "test@aramco.com");
                    break;
                }
                const subject = `${listNameText} Request ${itemId}: ${titleText}`;
                const to      = focalPointInput.value;
                const link    = "https://eft.aramco.com/";   // always this link

                const body = `Dear ${serviceProviderSelect.value} team,

You need to do the following:

1. Please visit ${link} for more information.

2. Read responsibilities that are on you during the readiness assessment process.

3. Prepare a List of Readiness incl. all manpower and equipment (incl. lifting equipment by piece, separately each sling, shackles, etc.) that will be involved in operations.

4. Upload all necessary paperwork to the respective folders in Aramco cloud, including:
   - CVs, certificate, fitness reports for manpower
   - Maintenance reports, inspection reports, load test reports, COCs, manuals, specs for equipment (Engineering items and Safety items)

Regards
${listNameText} Coordinator`;

                const mailto = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc.join(";"))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                window.location.href = mailto;

                // ----- 8️⃣ Show success dialog (unchanged UI) ---------------
                $("#dialog").html(
                  '<div class="dialog-content">' +
                  '<h2 class="dialog-title">Record and email generated successfully.</h2>' +
                  '<p class="dialog-message">Your record:<br><br><strong>' + titleText + '</strong><br><br>has been generated and you will receive an email notification shortly.</p>' +
                  '<p class="dialog-action">Satisfied with our service? <a href="https://pj1.aramco.com.sa/thumbsup/index.html#/employee/shturndx/30033752" target="_blank" style="color:#007bff; text-decoration:none;">Give us a thumb up!</a></p>' +
                  '<div class="dialog-buttons"><button class="dialog-button" onclick="window.location.reload()">Generate Another Record</button></div>' +
                  '</div>'
                );

                $("#dialog").dialog({
                  modal: true,
                  closeOnEscape: false,
                  dialogClass: "custom-dialog",
                  width: "auto",
                  height: "auto",
                  open: function () {
                    $(this).closest(".ui-dialog").find(".ui-dialog-titlebar-close").hide();
                  }
                });
              })
              .catch(err => {
                // Attachments failed – still show the record (it was created)
                alert("The record was created, but some attachments could not be uploaded. See console for details.");
                console.error(err);
              });
          },
          // ----- error: item creation ------------------------------------
          function (sender, args) {
            console.error("❌ Error creating item:", args.get_message());
          }
        );
      },
      // ----- error: loading columns ------------------------------------
      function (sender, args) {
        console.error("❌ Error loading list columns:", args.get_message());
      }
    );
  });
}

/*=====================================================================
  Navigation helper – go back to the dashboard list view
=====================================================================*/
function goToList() {
  const event = new Event("click");
  const dashboardBtn = parent.document.querySelector('button[onclick="openTab(event, \'Dashboard\')"]');
  if (dashboardBtn) dashboardBtn.dispatchEvent(event);
  window.location.reload();
}