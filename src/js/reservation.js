/* 
 * localStorage.editOccupancyOid
 * localStorage.editOccupancyRid
 */

zakEditReservation= false;
zakRoomsSetups= new Array();
_tempChildren= new Array();
_tempExtras= {};
_zakYourVat= false;
_tempPricing= {};

function getResExtras() {
  try {
    return JSON.parse(zakEditReservation.extras);
  } catch(e) {return []};
}

function designOccupancy() {
  llLoadOccupancy(localStorage.editOccupancyOid, function(ses, recs) {
    _designOccupancy(recs.rows.item(0));
  });
}

function designChildren() {
  var res= '';
  $('.rchildren').remove();
  for (var i= 0; i< _tempChildren.length; i++) {
    var child= _tempChildren[i];
    var age= child.age;
    res+= '<tr class="rchildren"><td></td><td>Age: ' + age + '</td>'; 
    res+= '<td><b><a href="javascript:delChild(' + age +','+ i + ')">Delete</a></b></td></tr>'; 
  }
  $('#table_occupancy').append(res);
  $('#childrenCounter').val(_tempChildren.length);
}

function delChild(age, j) {
  var newchi= new Array();
  for (var i= 0; i< _tempChildren.length; i++)
    if (i!=j) newchi.push(_tempChildren[i]);
  _tempChildren= newchi;
  designChildren();
}

function _designOccupancy(aocc) {
  $('#oremarks').val(aocc.remarks) || '';
  $('#selOccupancy').val(aocc.id_room);
  $('#selectSetup').val(aocc.id_room_setup || '');
  $('#ocustomer').val(aocc.customer || '');

  var occupancy= aocc.occupancy;
  if (!occupancy) {
    $('#adults').val(1);
    $('#childrenCounter').val(0);
    $('.rchildren').remove();
  } else {
    occupancy= JSON.parse(occupancy);
    var adults= occupancy.adults;
    var children= occupancy.children;
    $('#childrenCounter').val(children.length);
    $('#adults').val(adults);
    _tempChildren= children;
    designChildren();
  }
}

function designExtras() {
  var extras= getResExtras();
  if (extras.length == 0) {
    $('#assignedExtras').empty();
    return;
  }
  var res= '<table class="assignedExtras">', e;
  for (var i= 0; i< extras.length; i++) {
    e= extras[i];
    res+= '<tr><td><b id="extra_id_' + e.id +'">' + e.name + '</b>:</td>'; 
    res+= '<td><input class="extraHow" type="text" id="extra_how_' + e['id'];
    res+= '" value="' + e['how'] + '"></input></td>'; 
    res+= '<td><input class="extraCost" type="text" id="extra_cost_' + e['id'];
    res+= '" value="' + parseFloat(e['cost']).toFixed(2) + '"></input></td>'; 
    res+= '<td><a href="javascript:removeAssignedExtra(' + e['id'] + ')"><b>Delete</b></a></td>';
    res+= '</tr>';
  }
  res+= '<tr><td colspan="4" style="text-align:center">';
  res+= '<input type="submit" value="Update extras" onclick="saveUpdatedExtras()">';
  res+= '</input></td></tr></table>';
  $('#assignedExtras').html(res);
}

function loadRoomPricing(rid, prid) {
  var prices= _tempPricing[prid];
  if (!prices) {
    llGetDatedPricing(zakEditReservation.dfrom, zakEditReservation.dto, 1,
      function(pps) {
        return 
      }, 
      function(ses, err) {
        humanMsg.displayMsg('Bad error there: '+ err.message);
      });

  }
}

function getRoomPricing(room, prid, rprices) {
  var rid= room.id;
  var roomp= rprices[rid];
  if (roomp) {
    return roomp;
  }
  if (!prid) {
    var prices= [];
    for (var i= 0; i< diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto); i++) {
      prices.push(0.0);
    }
    return prices;
  }
  var cpricing= _tempPricing[prid];
  var rt= room.id_room_type;
  var res= new Array();
  for (var i= 0; i< diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto); i++) {
    var dprice= cpricing[i];
    try {
      var p= dprice[rt + ''];
    } catch(e) {var p= 0.0};
    if (!checkFloat(p)) p= 0.0;
    res.push(p);
  }
  return res;
}

function _desingPrices(prices) {
  var res= '<thead class="pricing"><tr><th>Day</th>';
  for (var i= 0; i< zakEditReservation.rooms.length; i++) {
    var rcode= zakEditReservation.rooms[i].code;
    res+= '<th>'+rcode+'</th>';
  }
  res+= '</thead>';

  var icycle= diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto);
  function _strDay(dayidx) {
    var d= unixDate(zakEditReservation.dfrom) + (86400 * parseInt(dayidx - 1));
    return  strDate(d, 'd/m');
  }
  function _strPri(dayidx, rid) {
    try {
      return prices[rid][dayidx];
    } catch(e) {console.log('Pricing error: ' + e.message); return 0.0};
  }

  function _inpRoom(dayidx, rid) {
    var iid= ' id="price_' + rid + '_' + dayidx + '" ';
    var sty= ' style="width:50px" ';
    var onc= ' onchange="computeRoomsAmount(' + rid + ')"' ;
    return '<td><input ' + iid + sty + onc + 'type="text" value="' + _strPri(i, rid) + '"></input></td>';
  }

  for (var i= 0; i< icycle; i++) {
    tres= '<tr><td>'+_strDay(i)+'</td>';
    for (var j= 0; j< zakEditReservation.rooms.length; j++) {
      var rid= zakEditReservation.rooms[j].id;
      tres+= _inpRoom(i, rid);
    }
    tres+= '</tr>';
    res+= tres;
  }
  res+= '<tr><td><b id="total_sum">...</b></td>';
  for (var i= 0; i< zakEditReservation.rooms.length; i++) {
    var rid= zakEditReservation.rooms[i].id;
    res+= '<td><b id="partial_sum_' + rid + '">...</b></td>';
  }
  res+= '</tr>';
  $('#tablepricing').html(res);
  computeRoomsAmount();
}

function computeRoomsAmount(onlyrid) {
  var icycle= diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto);
  for (var i= 0; i< zakEditReservation.rooms.length; i++) {
    var rid= zakEditReservation.rooms[i].id;
    if (onlyrid && onlyrid != rid) continue;
    var pcount= 0.0;
    for (var j= 0; j< icycle; j++) {
      var s= '#price_' + rid + '_' + j;
      var p= $(s).val();
      if (!p) {
        humanMsg.displayMsg('Please, specify good valus (use the . for decimal values)', 1);
        return;
      }
      p= parseFloat(p);
      if (!checkFloat(p)) {
        humanMsg.displayMsg('Please, specify good valus (use the . for decimal values)', 1);
        return;
      }
      pcount+= p;
      $('#partial_sum_' + rid).html(pcount.toFixed(2));
    }
  }
  var tcount= 0.0;
  for (var i= 0; i< zakEditReservation.rooms.length; i++) {
    var rid= zakEditReservation.rooms[i].id;
    var partial= $('#partial_sum_' + rid).html();
    tcount+= parseFloat(partial);
  }
  $('#total_sum').html(tcount.toFixed(2));
}

function changePricing() {
  designPrices($('#cmbpricing').val(), $('#cmbPricingRoom').val());
}

function changeOccupancy() {
  localStorage.editOccupancyOid= $('#selOccupancy').val();
  designOccupancy();
}

function designPrices(prid, onlyroom) {
  /* make sure pricing info is loaded */
  console.log('Writing prices: prid= ' + prid + ', onlyroom: ' + onlyroom);
  if (prid && !_tempPricing[prid]) {
    llGetDatedPricing(prid, zakEditReservation.dfrom, zakEditReservation.dto, 1,
      function(pps) {
        _tempPricing[prid]= pps;
        designPrices(prid, onlyroom);
      }, 
      function(ses, err) {
        humanMsg.displayMsg('Bad error there: '+ err.message);
      });
    return;
  }

  /* let's go */
  try {
    /* force id_pricing */
    if (prid) rprices= -1;
    else var rprices= JSON.parse(zakEditReservation.custom_pricing);
  } catch(e) {var rprices= -1};
  var res= {};
  for (var i= 0; i< zakEditReservation.rooms.length; i++) {
    var room= zakEditReservation.rooms[i];
    /* Maintain edited prices for this room */
    if (onlyroom && onlyroom != room.id) {
      var roomprices= new Array();
      for (j= 0; j< diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto); j++) {
        roomprices.push($('#price_' + room.id + '_' +j).val());
      }
      res[room.id]= roomprices;
    } else {
      var roomprices= getRoomPricing(room, prid, rprices);
      res[room.id]= roomprices;
    }
  }
  _desingPrices(res);
}

function designCmbPricing() {
  llLoadPricings(function(ses, recs) {
    var res= '';
    for (var i= 0; i< recs.rows.length; i++) {
      var p= recs.rows.item(i);
      res+= '<option value="' + p.id + '">'+p.name+ '</option>';
    }
    $('#cmbpricing').html(res);
  });
  var rres= '<option value="">Alls</option>';
  for (var j= 0; j< zakEditReservation.rooms.length; j++) {
    var rr= zakEditReservation.rooms[j];
    rres+= '<option value="' + rr.id + '">' + rr.name + '</option>';
  }
  $('.cmbPricingRoom').html(rres);
}

function designMain() {
  $('#rremarks').val(zakEditReservation.remarks || '');
  designCmbPricing();
  designExtras();
  designPrices();
  designVariations();
}

function designVariations() {
  llGetVariations(function(ses, recs) {
    var res= '';
    for (var i= 0; i< recs.rows.length; i++) {
      var v= recs.rows.item(i);
      res+= '<option value="' + v.id + '">' + v.name + '</option>';
    }
    $('#cmbalter').html(res);
  });
}

function designReservation(noOccupancy) {
  llLoadRoomSetups(function(ses, recs) {
    for (var i= 0; i< recs.rows.length; i++ ) 
      zakRoomsSetups.push(recs.rows.item(i));

    var res= '<option value="">--</option>';
    for (var j= 0; j< zakRoomsSetups.length; j++) {
      var z= zakRoomsSetups[j];
      res+= '<option value="' + z.id + '">' + z.name + '</option>';
    }
    $('#selectSetup').empty().html(res);

    llLoadExtras(function(ses, recs) {
      var eres= '';
      for (var k= 0; k< recs.rows.length; k++) {
        var e= recs.rows.item(k);
        eres+= '<option value="' + e.id + '">' + e.name + '</option>';
        _tempExtras[e.id]= {cost: e.cost, perday: e.perday, name: e.name};
      }
      $('#selectExtra').empty().html(eres);
    });

    var r= llGetReservationFromRid(localStorage.editOccupancyRid,
      function(reservation) {
        zakEditReservation= reservation;

        var rooms= zakEditReservation.rooms;
        var srooms= '';
        for (var j= 0; j< rooms.length; j++) {
          var room= rooms[j];
          srooms+= '<option value="' + room.id + '">' + room.name + '</option>';
        }
        $('#selOccupancy').empty().html(srooms);

        designMain();
        if (!noOccupancy) 
          designOccupancy();
      }, function(ses, err) {
        humanMsg.displayMsg('Error there: ' + err.message, 1);
      });
  });
}

function saveOccupancy() {
  var ocust= $('#ocustomer').val();
  var ads= $('#adults').val();
  var occ= JSON.stringify({adults: ads, children: _tempChildren});
  llModOccupancy(localStorage.editOccupancyOid, {occupancy: occ, customer: ocust},
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
      designOccupancy();
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message);
    });
}

function saveRooms() {
  var rmrks= $('#oremarks').val();
  var rsetup= $('#selectSetup').val() || '';
  /*var ocust= $('#ocustomer').val() || '';*/
  /*if (!ocust) {*/
  /*humanMsg.displayMsg('Please, insert a valid customer name', 1);*/
  /*return;*/
  /*}*/
  llModOccupancy(localStorage.editOccupancyOid, {remarks: rmrks, id_room_setup: rsetup},
    function(ses, recs) {
      designOccupancy();
      humanMsg.displayMsg('Sounds good');
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message, 1);
    });
}

function askNewRSetup() {
  var el= $('#addRSetupButton');
  var x= el.offset().left;
  var y= el.offset().top;
  $('#rsetup_div').modal({position: [y,x]});
}
function addRSetup() {
  var rsname= $('#rsetup_name').val();
  llAddRSetup(rsname, localStorage.editOccupancyOid,
    function(ses, recs) {
      $.modal.close();
      humanMsg.displayMsg('Sounds good');
      designReservation();
    },
    function(ses, err) {
      humanMsg.displayMsg('Error: ' + err.message, 1);
    });
}

function askChildren() {
  var el= $('#addChildrenButton');
  var x= el.offset().left;
  var y= el.offset().top;
  $('#children_div').modal({position: [y,x]});
}
function addChildren() {
  var age= $('#children_age').val();
  if (parseInt(age) != age) {
    humanMsg.displayMsg('Please, specify good values', 1);
    return;
  }
  _tempChildren.push({age: age});
  designChildren();
  $.modal.close();
}

function askExtra() {
  if (!_zakYourVat) { 
    llGetPropertySettings(getActiveProperty(),
      function(ses, recs, sets) {
      _zakYourVat= sets.vatSettingsPerc;
      askExtra();
      });
    return;
  }
  var el= $('#addExtraButton');
  var x= el.offset().left;
  var y= el.offset().top;
  $('#addextra_div').modal({position: [y,x]});
}

function askVariation() {
  $('#vapply').hide();
  $('.vsave').hide();
  $('#vtype').val(1);
  $('#vpercsym').show();
  $('#addvariation_div').modal();
}

function writeVariation(vt, vv, rooms) {
  console.log('I write variation');
}

function changeVtype() {
  if ($('#vtype').val() == 1)
    $('#vpercsym').show();
  else
    $('#vpercsym').hide();
}

function stepSaveApplyVariation() {
  $('#vdecide').hide();
  $('#vsave').show();
  $('#vapply').show();
  $('#vsaveapply').show();
}

function stepSaveVariation() {
  $('#vdecide').hide();
  $('#vsave').show();
  $('#vsavesave').show();
}

function stepApplyVariation() {
  $('#vdecide').hide();
  $('#vapply').show();
  $('#vapplyapply').show();
}

function bo() {
  var vt= $('#vtype').val();
  var vv= $('#vvalue').val();
  if (!checkFloat(vv)) {
    humanMsg.displayMsg('Specify a good variation value before');
    return;
  }
  var rooms= $('#cmbAlterRoom').val();
  $.modal.close();
  writeVariation(vt, vv, rooms);
}

function saveApplyVariation() {
  var vt= $('#vtype').val();
  var vv= $('#vvalue').val();
  if (!checkFloat(vv)) {
    humanMsg.displayMsg('Specify a good variation value before');
    return;
  }
  var vn= $('#vname').val();
  if (!vn) {
    humanMsg.displayMsg('Specify a good name to save it!');
    return;
  }
  llNewVariation(vt, vl, vn,
    function(ses, recs) {
      designVariations();
      var rooms= $('#cmbAlterRoom').val();
      writeVariation(vt, vv, rooms);
    });
}

function saveExtra() {
  var ename= $('#extra_name').val();
  var ecost= $('#extra_cost').val();
  var evat= $('#extra_vat').val();
  if (!ename || !checkFloat(ecost) || !checkFloat(evat)) {
    humanMsg.displayMsg('Please, specify good values (decimal values? use the dot [.])');
    return;
  }
  var eperday= $('#extra_perday').val();
  var how= $('#extra_how').val();
  if (!eperday) var atotal= ecost;
  else {
    var n= diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto);
    var atotal= ecost * n;
  }
  atotal*= how;
  var aextras= getResExtras();
  llAddExtra(localStorage.editOccupancyRid, ename, ecost, eperday, evat, how, aextras, atotal,
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
      designReservation();
      $.modal.close();
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message);
      $.modal.close();
    });
}

function assignExtra() {
  var eid= $('#selectExtra').val();
  var how= $('#selectExtraHow').val();
  var e= _tempExtras[eid];
  var ecost= parseFloat(e.cost);
  var epd= e.perday;
  var ename= e.name;
  var evat= e.vat;
  if (epd) {
    var d= diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto);
    var etotal= ecost * d;
  } else
    var etotal= ecost;
  etotal*= parseInt(how);

  var extras= getResExtras();
  var found= false;
  for (var i= 0; i< extras.length; i++) {
    if (extras[i].id == eid) {
      extras[i].cost= parseFloat(extras[i].cost) + etotal;
      extras[i].how=  parseInt(extras[i].how) + parseInt(how);
      found= true;
      break
    }
  }
  if (!found) {
    extras.push({name: ename, cost: etotal, id: eid, how: how, vat: evat});
  }
  extras= JSON.stringify(extras);
  llModReservation(localStorage.editOccupancyRid, {extras: extras},
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
      designReservation();
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message);
    });
}

function removeAssignedExtra(eid) {
  var extras= getResExtras();
  var newextras= [];
  for (var i= 0; i< extras.length; i++) {
    var e= extras[i];
    if (e.id != eid) newextras.push(e);
  }
  newextras= JSON.stringify(newextras);
  llModReservation(localStorage.editOccupancyRid, {extras: newextras},
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
      designReservation(1);
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message);
    });
}

function saveUpdatedExtras() {
  var extras= getResExtras();
  for (var i= 0; i< extras.length; i++) {
    var e= extras[i];
    var ecost= $('#extra_cost_' + e.id).val();
    var ehow= $('#extra_how_'+ e.id).val();
    if (parseInt(ehow) != ehow || !checkFloat(ecost) ) {
      humanMsg.displayMsg('Please, specify good values (decimal? use the "." [dot])');
      return;
    }
    e.cost= ecost;
    e.how= ehow;
  }
  extras= JSON.stringify(extras);
  llModReservation(localStorage.editOccupancyRid, {extras: extras},
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
      designReservation(1);
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message);
    });
}


function saveRemarks() {
  var r= $('#rremarks').val();
  llModReservation(localStorage.editOccupancyRid, {remarks: r},
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message, 1);
    });
}

function saveRoomsPrices() {
  var prices= {};
  for (var i= 0; i< zakEditReservation.rooms.length; i++) {
    var rprices= [];
    var rid= zakEditReservation.rooms[i].id;
    for (var j= 0; j< diffDateDays(zakEditReservation.dfrom, zakEditReservation.dto); j++) {
      rprices.push($('#price_' + rid + '_' + j).val());
    }
    prices[rid]= rprices;
  }
  prices= JSON.stringify(prices);
  llModReservation(localStorage.editOccupancyRid, {custom_pricing: prices},
    function(ses, recs) {
      humanMsg.displayMsg('Sounds good');
    },
    function(ses, err) {
      humanMsg.displayMsg('Error there: ' + err.message);
    });
}

$(document).ready(function() {
  designReservation();
});
