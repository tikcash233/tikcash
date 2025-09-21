(async function(){
  try{
    const m = await import('./src/events.js');
    console.log('events loaded', typeof m.emitTransactionEvent);
  }catch(e){
    console.error('failed to load events module', e);
    process.exit(1);
  }
})();