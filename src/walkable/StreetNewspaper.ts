import * as THREE from 'three';

/** Interpretive folded newspaper, held at the shopkeeper's relaxed left hand.
 * The masthead/date identify the issue; this is not a facsimile of its front page. */
export function createStreetNewspaper(): THREE.Group {
  const paper = new THREE.Group();
  paper.name = 'September 7 Daily News';
  // Actor coordinates: left hand at +X, fingers down, palm toward the thigh.
  // The upper folded edge sits between thumb and fingers; the sheet hangs clear.
  paper.position.set(.281,.825,.045);
  paper.rotation.y = Math.PI / 2;
  const texture = typeof document === 'undefined' ? undefined : newspaperTexture();
  const material = new THREE.MeshBasicMaterial({map:texture,color:0xc7bba2,side:THREE.FrontSide});
  const geometry = new THREE.PlaneGeometry(.25,.34,8,1);
  const positions = geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i);
    positions.setXYZ(i,x,positions.getY(i)-.155,.012*Math.pow(x/.125,2));
  }
  geometry.computeVertexNormals();
  const sheet=new THREE.Mesh(geometry,material);sheet.name='Folded newsprint';
  paper.add(sheet);
  // A second slightly offset leaf gives the folded edge thickness from either side.
  const back=sheet.clone();back.geometry=geometry.clone();back.position.set(.002,-.003,-.002);
  const index=back.geometry.index!;
  for(let i=0;i<index.count;i+=3) {
    const first=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,first);
  }
  const uv=back.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setX(i,1-uv.getX(i));
  back.geometry.computeVertexNormals();
  back.name='Newspaper back leaf';paper.add(back);
  return paper;
}

function newspaperTexture(): THREE.CanvasTexture {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=704;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#eee4ce';ctx.fillRect(0,0,512,704);
  ctx.fillStyle='#30291f';ctx.textAlign='center';
  ctx.font='bold 56px Georgia, serif';ctx.fillText('DAILY NEWS',256,79);
  ctx.font='18px Georgia, serif';ctx.fillText('THURSDAY, SEPTEMBER 7, 1854',256,111);
  ctx.fillRect(26,125,460,3);
  ctx.font='bold 23px Georgia, serif';ctx.fillText('LETTERS TO THE EDITOR',256,169);
  ctx.font='19px Georgia, serif';ctx.fillText('THE CHOLERA IN SOHO',256,203);
  // Suggest narrow letterpress columns without inventing a full newspaper article.
  for(let column=0;column<3;column++) for(let line=0;line<40;line++) {
    ctx.fillStyle=line%3===0?'#766b59':'#8c806b';
    const width=126-((line*13+column*7)%24);
    ctx.fillRect(29+column*157,227+line*10,width,2);
  }
  ctx.strokeStyle='#b3a68b';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(12,352);ctx.lineTo(500,349);ctx.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
