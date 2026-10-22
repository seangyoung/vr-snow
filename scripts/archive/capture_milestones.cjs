// Optional authoring tool. Set PLAYWRIGHT_MODULE to an installed Playwright package.
// Run the frozen builds with: python3 -m http.server 4180 --directory milestone-archives
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const only=process.argv[3];
 const reportPath=path.join(root,'docs/milestones/browser-checks.json');
 const reports=only && fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)).filter(r=>r.slug!==only) : [];
 try {
  for(const item of JSON.parse(fs.readFileSync(path.join(root,'docs/milestones/index.json')))){
   if(only && item.slug!==only)continue;
   const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
   const folder=path.join(root,'docs/milestones/media');fs.mkdirSync(folder,{recursive:true});
   await page.goto(`${process.argv[2] || 'http://127.0.0.1:4180'}/${item.slug}/site/`);
   if(Number(item.slug.slice(0,2))>=7){
    await page.locator('[data-action="new-inquiry"]').click();
    await page.locator('[data-action="dismiss-day"]').click();
   }
   await page.waitForTimeout(4000);
   await page.screenshot({path:path.join(folder,`${item.slug}-office.png`)});
   // Select Snow or the earlier desk/marker through the rendered scene, then use normal UI.
   await page.mouse.click(...(Number(item.slug.slice(0,2))>=5 ? [800,500] : [720,450]));
   if(Number(item.slug.slice(0,2))>=7){
    for(const id of ['begin','people','accept'])await page.locator(`[data-choice-id="${id}"]`).click();
    await page.getByRole('button',{name:'Close conversation',exact:true}).click();
   }else{
    await page.getByRole('button',{name:'Where should we begin the inquiry?',exact:true}).click();
    await page.getByRole('button',{name:'Close interview',exact:true}).click();
   }
   await page.locator('[data-action="map"]').click();
   await page.locator('[data-action="travel"][data-location-id="broad-street"]').click();
   await page.waitForTimeout(4000);
   await page.screenshot({path:path.join(folder,`${item.slug}-street.png`)});
   if(!(await page.locator('body').innerText()).includes('BROAD STREET PUMP'))throw Error('Travel failed: '+item.slug);
   reports.push({slug:item.slug,commit:item.commit,office:'default spawn',street:'default arrival via map',viewport:'1440x900',browser:await browser.version(),renderer:'Chrome headless / SwiftShader',errors});
   console.log(item.slug,JSON.stringify(errors));
   await page.close();
  }
 } finally {await browser.close();}
 fs.writeFileSync(reportPath,JSON.stringify(reports,null,2)+'\n');
 if(reports.some(r=>r.errors.length))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
