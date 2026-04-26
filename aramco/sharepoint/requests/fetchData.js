async function fetchData(url) {
  const allItems = []; // will hold every record

  // First request – you can add $select/$filter here if you want
  let nextUrl = `${url}?$orderby=Modified desc&$top=5000`; // Request up to 5000 items at once

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json; odata=verbose' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${nextUrl} – ${response.status}`);
    }

    const data = await response.json();

    // In the classic OData v3 format SharePoint returns results in data.d.results
    allItems.push(...data.d.results);

    // Get the URL for the next set of results
    nextUrl = data.d.__next;
  }

  // Return the same shape the rest of the script expects
  return { d: { results: allItems } };
}

export { fetchData };