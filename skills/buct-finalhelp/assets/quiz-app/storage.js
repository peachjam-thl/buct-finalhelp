(function(root){
  'use strict';
  const fallback='buct-finalhelp:current-bank';
  async function database(){return new Promise((resolve,reject)=>{
    if(!root.indexedDB){reject(new Error('IndexedDB unavailable'));return;}
    const timer=setTimeout(()=>reject(new Error('Storage timeout')),2500);
    const request=indexedDB.open('buct-finalhelp-library',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('workspace'))request.result.createObjectStore('workspace');};
    request.onsuccess=()=>{clearTimeout(timer);resolve(request.result);};request.onerror=()=>{clearTimeout(timer);reject(request.error);};
  });}
  async function get(){
    try {const db=await database();return await new Promise((resolve,reject)=>{
      const tx=db.transaction('workspace','readonly'), request=tx.objectStore('workspace').get('current');
      request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();
    });} catch {try{return JSON.parse(localStorage.getItem(fallback)||'null');}catch{return null;}}
  }
  async function put(bank){
    try {const db=await database();await new Promise((resolve,reject)=>{
      const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(bank,'current');
      tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};tx.onabort=()=>{db.close();reject(tx.error);};
    });return true;}catch {try{localStorage.setItem(fallback,JSON.stringify(bank));return true;}catch{return false;}}
  }
  root.FinalHelpStorage={get,put};
})(typeof globalThis!=='undefined'?globalThis:this);
