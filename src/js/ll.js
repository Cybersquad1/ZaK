function llGetProperties(cbs, cbe) {
  var db= zakOpenDb();
  db.readTransaction(function(ses) {
    ses.executeSql('select * from property', new Array(), cbs, cbe);
  });
}

function llDelProperty(pid, cbs, cbe) {
  var db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('delete from property where id = ?', [pid], cbs, cbe);
  });
}

function llNewProperty(name, cbs, cbe) {
  var db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('insert into property (name) values (?)', [name], cbs, cbe);
  });
}

function llModProperty(pid, params, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    var key,value;
    var t= new Array();
    var qparams= new Array();
    for(key in params) {
      t.push(key + '=?');
      qparams.push(params[key]);
    }
    qparams.push(pid);
    var s= t.join(',');
    var s= 'update property set ' + s + ' where id = ?';
    ses.executeSql(s, qparams, cbs, cbe);
  });
}

function llModPropertyW(pid, params, cbs, cbe) {
  llModProperty(pid, params, 
    function(ses, recs) {
      var prop= getActiveProperty();
      for (var k in params) prop[k]= params[k];
      setActiveProperty(prop);
      cbs(ses, recs);
    }, cbe);
}

/* cbs is cbs(rows) */
function llLoadRooms(pid, cbs, cbe) {
  var db= zakOpenDb();
  db.readTransaction(function(ses) {
    console.log('Reading rooms for property ' + pid);
    ses.executeSql('select * from room where id_property = ?', [pid], cbs, cbe);
  });
}

function llModRoom(rid, name, code, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('update room set name= ?, code = ? where id = ?', [name,code,rid], cbs, cbe);
  });
}

function llDeleteRooms(pid, tobedeleted, cbs, cbe) {
  var d= multipleSqlWhere(tobedeleted, 'id');
  var of= d['qry'];
  var qarray= d['qar'];
  var db= zakOpenDb();
  db.transaction(function(ses) {
    var sqlstr= 'delete from room where id_property = ' + pid + ' and (' + of + ')';
    ses.executeSql(sqlstr, qarray, cbs, cbe);
  });
}

function llNewRoom(pid, rcode, rname, cbs, cbe) {
  var db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('insert into room (code,name,id_property) values (?,?,?)', [rcode,rname,pid], cbs, cbe);
  });
}

function llLoadOccupancies(rids, dfrom, dto, cbs, cbe) {
  var udfrom= unixDate(dfrom);
  if(typeof(dto) == 'number' && dto < 1000) {
    var jdfrom= jsDate(dfrom);
    var udto= unixDate(dateAddDays(jdfrom, dto));
  } else var udto= unixDate(dto);

  var q= multipleSqlWhere(rids, 'id');
  var qar= q['qar'];
  var qry= q['qry'];

  var db= zakOpenDb();
  db.readTransaction(function(ses) {
    qar.push(udfrom);qar.push(udto);
    var s= 'select * from occupancy where (' + qry + ') and dfrom >= ? and dfrom <= ?';
    s+= ' order by dfrom';
    ses.executeSql(s, qar, cbs, cbe);
  });
}

function llCheckOccupancyChance(oid, rid, day, n, args, cb) {
  var db= zakOpenDb();
  db.transaction(function(ses) {
    var s= 'select min(dfrom) as dfrom from occupancy where id_room = ? and dfrom > ?';
    if (oid) s+= ' and occupancy.id != ' + oid;
    ses.executeSql(s, [rid, unixDate(day)], 
      function(ses, recs) {
        var df= recs.rows.item(0).dfrom;
        if (!df) {cb(ses, args);return;}
        var diff= diffDateDays(day, df);
        if (n <= diff) {cb(ses, args);return;}
        cb(ses, false);
      },
      function(ses, err) {
        console.log('Error here: ' + err.message);
        cb(ses, false);
      });
  });
}

function llDelOccupancy(oid, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(
    function(ses) {
      ses.executeSql('delete from occupancy where oid = ?', [oid], cbs, cbe);
    });
}

function llMoveOccupancy(oid, udfrom, udto, rid, cbs, cbe) {
  console.log('Updating dfrom, dto, idr, oid' + [udfrom,udto,rid,oid].join(', '));
  var targs= {udfrom: udfrom, udto: udto, rid: rid, oid: oid};
  llCheckOccupancyChance(oid, rid, udfrom, diffDateDays(udfrom, udto), targs,
    function(ses, newargs) {
      if (!newargs) {
        cbs(false);
        return;
      }
      var nudfrom= newargs['udfrom'];
      var nudto= newargs['udto'];
      var rid= newargs['rid'];
      var oid= newargs['oid'];
      ses.executeSql('update occupancy set dfrom = ?, dto= ?, id_room= ? where id = ?',
                  [unixDate(udfrom), unixDate(udto), rid, oid], cbs, cbe);
    });
}

function llCopyOccupancy(occ, cust, udfrom, udto, rid, cbs, cbe) {
  var targs= {occ: occ, udfrom: udfrom, udto: udto, rid: rid, customer: cust};
  llCheckOccupancyChance(occ['id'], rid, udfrom, diffDateDays(udfrom, udto), targs,
    function(ses, args) {
      if (!args) {
        cbs(false);
        return;
      }
      var aocc= args.occ;
      var arid= args.rid;
      var audf= args.udfrom;
      var audt= args.udto;
      var acust= args.customer;
      console.log(acust);
      _addOcc(audf, audt, arid, acust, aocc['status'], aocc['id_reservation'], ses, cbs, cbe);
      }, cbe);
}

function _addOcc(udfrom, udto, rid, customer, stat, resid, ses, cbs, cbe) {
  var ss= 'insert into occupancy (dfrom,dto,id_room,customer,status,id_reservation) ';
  ss+= ' values (?,?,?,?,?,?)';
  ses.executeSql(ss, [unixDate(udfrom), unixDate(udto), rid, customer, stat, resid],
    function(ses, recs) {
      var newoid= recs.insertId;
      ses.executeSql('select code from room where id = ?', [rid], cbs, cbe);
    });
}

/* cbs(okocc) */
/* resid is eventually the reservation id */
function llNewOccupancy(pid, resid, stat, rid, udfrom, ndays, customer, cbs, cbe) {
  var args= {pid: pid, resid: resid, stat: stat, rid: rid, udfrom: udfrom, ndays: ndays, customer: customer};
  llCheckOccupancyChance(false, rid, udfrom, ndays, args,
    function(ses, newargs) {
      if (!newargs) {
        /* you're requesting an impossible reservation */
        /* callback with false as first arg*/
        cbs(false);
        return;
      }
      var udfrom= unixDate(newargs['udfrom']);
      var udto= unixDate(dateAddDays(udfrom, newargs['ndays']));
      var resid= newargs['resid'];
      var rid= newargs['rid'];
      var customer= newargs['customer'];
      var stat= newargs['stat'];
      if (resid) 
        return _addOcc(udfrom, udto, rid, customer, stat, resid, ses, cbs, cbe);

      /* Add a new reservation */
      var s= 'insert into reservation (dfrom,dto,customer,status,id_property) values ';
      s+= '(?,?,?,?,?)';
      ses.executeSql(s, [udfrom,udto,customer,stat,pid],
        function(ses, recs) {
          resid= recs.insertId;
          return _addOcc(udfrom, udto, rid, customer, stat, resid, ses, cbs, cbe);
        }
      );
    },
    function(ses, err) {
      cbe(ses, err);
      return;
    });
}

function llModOccupancy(oid, params, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    var key,value;
    var t= new Array();
    var qparams= new Array();
    for(key in params) {
      t.push(key + '=?');
      qparams.push(params[key]);
    }
    qparams.push(oid);
    var s= t.join(',');
    var s= 'update occupancy set ' + s + ' where id = ?';
    ses.executeSql(s, qparams, cbs, cbe);
  });
}

/* cbs(reservation) */
function llGetReservationFromOid(oid, cbs, cbe) {
  console.log('Loading reservation ' + oid);
  db= zakOpenDb();
  db.readTransaction(function(ses) {
    s= 'select reservation.* from reservation join occupancy on reservation.id= occupancy.id_reservation ';
    s+= 'where occupancy.id = ?';
    ses.executeSql(s, [oid], 
      function(ses, recs){
        var reservation= recs.rows.item(0);
        ses.executeSql('select * from occupancy where id_reservation = ?', [reservation.id], 
          function(ses, recs) {
            var occs= new Array();
            var i= 0;
            for(i=0;i<recs.rows.length;i++) occs.push(recs.rows.item(i));
            reservation['occupancies']= occs;
            cbs(reservation);
          }, 
          function(ses, err) {cbe(ses, err);});
      }, 
      function(ses, err) {cbe(ses, err);});
  });
}
function llGetReservationFromRid(rid, cbs, cbe) {
  console.log('Loading reservation ' + rid);
  db= zakOpenDb();
  db.readTransaction(function(ses) {
    s= 'select reservation.* from reservation ';
    s+= 'where reservation.id = ?';
    ses.executeSql(s, [rid], 
      function(ses, recs){
        var reservation= recs.rows.item(0);
        ses.executeSql('select * from occupancy where id_reservation = ?', [reservation.id], 
          function(ses, recs) {
            var occs= new Array();
            var i= 0;
            for(i=0;i<recs.rows.length;i++) occs.push(recs.rows.item(i));
            reservation['occupancies']= occs;
            cbs(reservation);
          }, 
          function(ses, err) {cbe(ses, err);});
      }, 
      function(ses, err) {cbe(ses, err);});
  });
}

function llLoadRoomSetups(cbs, cbe) {
  var db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('select * from room_setup', [], cbs, cbe);
    });
}

function llAddRSetup(rname, cbs, cbe) {
  var db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('insert into room_setup (name) values (?)', [rname], cbs, cbe);
  });
}

function llModReservation(rid, params, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    var key,value;
    var t= new Array();
    var qparams= new Array();
    for(key in params) {
      t.push(key + '=?');
      qparams.push(params[key]);
    }
    qparams.push(rid);
    var s= t.join(',');
    var s= 'update reservation set ' + s + ' where id = ?';
    ses.executeSql(s, qparams, cbs, cbe);
  });
}

function llLoadExtras(cbs, cbe) {
  db= zakOpenDb();
  db.readTransaction(function(ses) {
    ses.executeSql('select * from extra', [], cbs, cbe);
  });
}

function llAddExtra(name, cost, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('insert into extra (name,cost) values (?,?)', [name, cost], cbs, cbe);
  });
}

function llLoadPricing(cbs, cbe) {
  db= zakOpenDb();
  db.readTransaction(function(ses) {
    ses.executeSql('select * from pricing', [], cbs, cbe);
  });
}

function llNewPricing(name, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('insert into pricing (name) values (?)', [name], cbs, cbe);
  });
}

function llModPricing(pid, params, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    var sd= updateStatement(params); 
    console.log(sd);
    sqry= sd['qry'];
    sqarr= sd['qarr'];
    sqarr.push(pid);
    ses.executeSql('update pricing set ' + sqry + ' where id = ?', sqarr, cbs, cbe);
  });
}

function llLoadPricesPeriods(pid, cbs, cbe) {
  db= zakOpenDb();
  db.readTransaction(function(ses) {
    var adfrom= unixDate();
    if (pid) 
      ses.executeSql('select * from pricing_periods where id_pricing = ? and dto > ? order by dfrom', [pid, adfrom], cbs, cbe);
    else
      ses.executeSql('select * from pricing_periods where id_pricing is null and dto > ? order by dfrom', [adfrom], cbs, cbe);
  });
}

function llNewPricesPeriod(pid, periods, cbs) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    console.log(periods);
    var i, per, sd, sqry, sqarr;
    console.log('Working on ' + periods.length + ' periods');
    for(i=0;i<periods.length;i++) {
      per= periods[i]; 
      if (per['del'] == 1) {
        console.log('period to be deleted');
        ses.executeSql('delete from pricing_periods where id = ?',[per['id']]);
        continue
      }
      if (per['id']) {
        console.log('period to be updated');
        sd= updateStatement(per); 
        sqry= sd['qry'];
        sqarr= sd['qarr'];
        sqarr.push(per['id']);
        ses.executeSql('update pricing_periods set ' + sqry + ' where id = ?', sqarr);
        continue;
      } 
      console.log('period to be inserted');
      if (pid) per['id_pricing']= pid;
      sd= insertStatement(per);
      ses.executeSql('insert into pricing_periods ' + sd['qry'], sd['qarr']);
    }
    cbs();
  });
}

function llDelPricesPeriod(pid, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
      ses.executeSql('delete from pricing_periods where id = ?', [pid], cbs, cbe);
  });
}

function llGetPeriodPricing(dfrom, dto, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('select * from pricing_periods');
  });
}

/*function llGetPricingPerioded(prid, dfrom, dto, cbs) {*/
/*db= zakOpenDb();*/
/*db.transaction(function(ses) {*/
/*ses.executeSql('select * from pricing where id = ?', [prid],*/
/*function(ses, recs) {*/
/*var pricing= recs.rows.item(0);*/
/*ses.executeSql('select * from pricing_periods where id_pricing = ?', [*/
/*}*/
/*});*/
/*}*/

/*function llGetRoomPricing(prid, dfrom, dto, cbs) {*/
/*if (!prid) {*/
/*var prices= new Array(), i;*/
/*for (i=0;i<diffDateDays(dfrom, dto);i++) {*/
/*prices.push(false);*/
/*}*/
/*cbs(prices);*/
/*}*/
/*db= zakOpenDb();*/
/*db.transaction(function(ses) {*/
/*var s= 'select * from pricing_periods where id_pricing = ? ';*/
/*s+= 'and dfrom < ? and dto > ? order by dfrom';*/
/*ses.executeSql(s, [prid, dto, dfrom], */
/*function(ses, recs) {*/
/*var periods= arrayFromRecords(recs);*/
/*var i, j, prices= new Array();*/
/*for(i=0;i<diffDateDays(dfrom, dto);i++) {*/
/*var d= dfrom+ (86400 * i), found= false;*/
/*for (j=0;j<periods.length;j++) {*/
/*var per= periods[j];*/
/*if (d>=per['dfrom'] && d<= per['dto']) {*/
/*prices.push(per); */
/*found= true;*/
/*break;*/
/*}*/
/*}*/
/*if (!found) {*/
/*if(per*/
/*}*/
/*}*/
/*});*/
/*});*/
/*}*/

function llGetDatedPricing(prid, xdfrom, xdto, excludelast, cbs, cbe) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    dfrom= unixDate(xdfrom);
    dto= unixDate(xdto);
    if (excludelast) {
      console.log('Excluding last day');
      dto-= 86400;
    } else console.log('INcluding las tday');
    recs= ses.executeSql('select * from pricing where id = ?', [prid],
      function(ses, frecs) {
        var frow= frecs.rows.item(0), i;
        var aprices= new Array();
        var plen= diffDateDays(dfrom, dto) + 1;
        for (i=0;i<plen;i++) {
          aprices.push({
             price_ro: frow.price_ro, 
             price_bb: frow.price_bb, 
             price_hb: frow.price_hb, 
             price_fb: frow.price_fb} );
        }
        ses.executeSql('select * from pricing_periods where id_pricing = ? and dfrom <= ? and dto >= ?', [prid, dto, dfrom],
          function(ses, recs) {
            console.log('Building with ' + recs.rows.length + ' periods');
            var cdate= parseInt(dfrom);
            dto= parseInt(dto)
            var limit= 1000, count= 0;
            while(1) {
              if (count>limit) {
                console.log('Ai ai aiaiaiaiai');
                break;
              }
              count+= 1;
              if (cdate > dto) break;
              for(j=0;j<recs.rows.length;j++) {
                var per= recs.rows.item(j);
                console.log(per['dfrom'] + ', ' + cdate + ', ' + per['dto']);
                if (parseInt(per['dfrom']) <= cdate && parseInt(per['dto']) >= cdate) {
                  var idx= diffDateDays(cdate, dfrom);
                  console.log('Found good period');
                  aprices[idx]= {
                     price_ro: per.price_ro, 
                     price_bb: per.price_bb, 
                     price_hb: per.price_hb, 
                     price_fb: per.price_fb};
                  break;
                }
              }
              cdate+= 86400;
            }
            console.log('Ok done');
            console.log(aprices);
            try {
              cbs(aprices);
            } catch(e) {};
          });
      });
  });
}

function llNextInvoiceNumber(pid, cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    var now= jsDate();
    now= unixDate('01/01/' + now.getFullYear());
    ses.executeSql('select max(n) as n from reservation_invoice where created > ? and id_property = ? ', 
        [now, pid], 
      function(ses, recs) {
        var r= recs.rows.item(0);
        var n= parseInt(r.n);
        console.log('This is the max: ' + n);
        if (parseInt(n) == n) n+= 1;
        cb(n || 1);
      },
      function(ses, err) {
        console.log('Error llNextInvoiceNumber: ' + err.message);
        cb(1);
      });
  });
}

function llGetInvoiceId(pid, rid, oid, cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    var q= 'select id,n from reservation_invoice where id_property = ? and id_reservation = ?';
    var qarr= [pid, rid];
    if (oid) {
      q+= ' and id_occupancy = ?';
      qarr.push(oid);
    }
    ses.executeSql(q, qarr,
      function(ses, recs) {
        console.log(recs);
        if (recs.rows.length != 1)
          return cb(false);
        return cb(recs.rows.item(0));
      });
  });
}

function llGetInvoiceHtml(iid, cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('select html from reservation_invoice where id = ?', [iid],
      function(ses, recs) {
        cb(recs.rows.item(0).html);
      });
  });
}

function llSaveInvoice(pid, n, rid, oid, html, cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    if (oid) {
      var s= 'insert into reservation_invoice (created, id_property, n,html,id_reservation,id_occupancy)';
      s+= ' values (?,?,?,?,?,?)';
      console.log(s);
      console.log([unixDate(), pid, n,html, rid,oid]);
      ses.executeSql(s, [unixDate(), pid, n,html, rid,oid], cb);
    } else {
      var s= 'insert into reservation_invoice (created, id_property, n,html,id_reservation)';
      s+= ' values (?,?,?,?,?)';
      console.log(s);
      console.log([unixDate(), pid, n,html, rid]);
      ses.executeSql(s, [unixDate(), pid, n,html, rid], cb);
    }
  });
}

_defSettings= {
  vatSettingsName: 'Vat taxes',
  vatSettingsPerc: '10',
  vatSettingsHeader: ''
}
function llGetPropertySettings(pid, cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('select * from psettings where id_property = ?', [pid], 
      function(ses, recs) {
        var dsets= _defSettings;
        if (recs.rows.length == 0) {
          sets= jQuery.extend({}, dsets);
          sets.defaultSettings= true;
        }
        else {
          var sets= recs.rows.item(0).settings;
          sets= JSON.parse(sets);
          for (var k in sets) dsets[k]= sets[k];
          dsets.defaultSettings= false;
          sets= dsets;
        }
        cb(ses, recs, sets);
      });
    });
}

function llNewInvoiceType(name, cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('insert into invoice_type (name) values (?)', [name], cb);
  });
}

function llGetItypes(cb) {
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('select id,name from invoice_type', [], cb);
  });
}

function llDelItype(iid, cb) {
  console.log('deleteing itype ' + iid);
  db= zakOpenDb();
  db.transaction(function(ses) {
    ses.executeSql('delete from invoice_type where id = ?', [iid], cb);
  });
}
