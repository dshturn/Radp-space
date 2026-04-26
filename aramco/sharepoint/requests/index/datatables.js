console.log('JavaScript file loaded');


export function initializeDataTables() {
  // Initialize DataTables
  if (document.getElementById('active-requests-table')) {
    $('#active-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": [3, 4],
          "type": "num"
        }
      ],
      "order": [[6, "desc"]]
    });
  }

  if (document.getElementById('completed-requests-table')) {
    $('#completed-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
    });
  }

  if (document.getElementById('onwcod-requests-table')) {
    $('#onwcod-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
    });
  }

  if (document.getElementById('offwcodwsd-requests-table')) {
    $('#offwcodwsd-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
    });
  }

  if (document.getElementById('onwsd-requests-table')) {
    $('#onwsd-requests-table').DataTable({
      "paging": true,
      "lengthChange": true,
      "searching": true,
      "ordering": true,
      "info": true,
      "autoWidth": false,
      "columnDefs": [
        {
          "targets": 3,
          "type": "num"
        }
      ],
      "order": [[5, "desc"]]
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

export function destroyDataTables() {
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
}