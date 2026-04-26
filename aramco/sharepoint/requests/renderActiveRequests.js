function renderActiveRequests(records, type) {
  const html = records.join('');
  if (type === 'Active Requests') {
    document.querySelector('#active-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'table';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('active-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('active-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#active-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Current Status</th>
      <th>Request Duration, Days</th>
      <th>Step Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
    `;
  } else if (type === 'Completed Requests') {
    document.querySelector('#completed-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'table';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('completed-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#completed-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Completed</th>
    `;
  } else if (type === 'ONWCOD') {
    document.querySelector('#onwcod-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'table';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('onwcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#onwcod-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'OFFWCOD&WSD') {
    document.querySelector('#offwcodwsd-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'table';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('offwcodwsd-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#offwcodwsd-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'ONWSD') {
    document.querySelector('#onwsd-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'table';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('onwsd-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#onwsd-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'SAOWCOD') {
    document.querySelector('#saowcod-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'table';
    document.getElementById('sagwcod-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('saowcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#saowcod-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  } else if (type === 'SAGWCOD') {
    document.querySelector('#sagwcod-requests-tbody').innerHTML = html;
    document.getElementById('active-requests-table').style.display = 'none';
    document.getElementById('completed-requests-table').style.display = 'none';
    document.getElementById('onwcod-requests-table').style.display = 'none';
    document.getElementById('offwcodwsd-requests-table').style.display = 'none';
    document.getElementById('onwsd-requests-table').style.display = 'none';
    document.getElementById('saowcod-requests-table').style.display = 'none';
    document.getElementById('sagwcod-requests-table').style.display = 'table';
    document.getElementById('sagwcod-requests-table').classList.add('animate-in');
    setTimeout(() => {
      document.getElementById('sagwcod-requests-table').classList.remove('animate-in');
    }, 1000);
    document.querySelector('#sagwcod-requests-table thead tr').innerHTML = `
      <th>Id</th>      
      <th>Title</th>
      <th>Division</th>
      <th>Status</th>
      <th>Request Duration, Days</th>
      <th>Created</th>
      <th>Modified</th>
      <th>Completed</th>
    `;
  }
  document.getElementById('results-title').innerText = type;

  // Destroy existing DataTables
  if ($.fn.dataTable.isDataTable('#active-requests-table')) {
    $('#active-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#completed-requests-table')) {
    $('#completed-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#onwcod-requests-table')) {
    $('#onwcod-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#offwcodwsd-requests-table')) {
    $('#offwcodwsd-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#onwsd-requests-table')) {
    $('#onwsd-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#saowcod-requests-table')) {
    $('#saowcod-requests-table').DataTable().destroy();
  }
  if ($.fn.dataTable.isDataTable('#sagwcod-requests-table')) {
    $('#sagwcod-requests-table').DataTable().destroy();
  }

  // Initialize DataTables
  if (type === 'Active Requests') {
    $('#active-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": [4, 5], 
          "type": "num"
        }
      ],
      "order": [[7, "desc"]] 
    });
  } else if (type === 'Completed Requests') {
    $('#completed-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'ONWCOD') {
    $('#onwcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'OFFWCOD&WSD') {
    $('#offwcodwsd-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'ONWSD') {
    $('#onwsd-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'SAOWCOD') {
    $('#saowcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  } else if (type === 'SAGWCOD') {
    $('#sagwcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 4,
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  }

  // Custom sorting function
  $.fn.dataTable.ext.order['duration'] = function(settings, col) {
    return this.api().column(col, {order: 'index'}).nodes().map(function(td, i) {
      var val = $(td).text().replace(/[^0-9]/g, '');
      return parseInt(val);
    });
  };
}

export { renderActiveRequests };