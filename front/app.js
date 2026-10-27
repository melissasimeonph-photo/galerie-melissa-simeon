
(function(){
/* ---------- Mode et données ---------- */
var MODE=window.MODE||'client';
var APERCU=MODE==='client'&&/[?&]apercu=1/.test(location.search);
var SEANCE=false,NOMDEF='',TXT={};
function majTxt(){
  NOMDEF=SEANCE?'Nouvelle séance':'Nouveau mariage';
  TXT=SEANCE?{ajouter:'Sélectionner cette photo',retirer:'Retirer de ma sélection',dans:'Dans votre sélection',titreSel:'Sélection du client'}:{ajouter:'Ajouter à la sélection album',retirer:'Retirer de la sélection album',dans:'Dans la sélection album',titreSel:'Sélection d’album'};
}
majTxt();
function LIVRE(){return SEANCE&&ADM.phase==='livraison'}
function SELP(){return SEANCE&&!LIVRE()}
function albumOff(){return ADM.albumActif===false||LIVRE()}
var COLLPUB=window.COLL||null;           // infos publiques injectées par le serveur (page client)
var SLUG=COLLPUB?COLLPUB.slug:null,CID=null,PERM={},VARS={};
// Adresse d'une image : côté client via la session, côté photographe via l'API protégée
function SRC(n,v){
  v=v||'web';
  if(MODE==='admin'){var a=VARS[n]||{};if(SELP()||!a[v])v=a[v]&&!SELP()?v:a.apercu?'apercu':a.mini&&v!=='web'?'mini':a.web?'web':a.mini?'mini':'hd';return '/admin/api/img/'+CID+'/'+n+'/'+v}
  // Après la livraison, l'adresse change : le navigateur ne réutilise pas l'aperçu filigrané gardé en mémoire
  var q=[];if(APERCU)q.push('apercu=1');if(ADM.phase==='livraison')q.push('l='+(ADM.livre||1));
  return '/img/'+SLUG+'/'+n+'/'+v+(q.length?'?'+q.join('&'):'');
}
function api(chemin,opts){
  opts=opts||{};var o={method:opts.method||'GET',headers:{},credentials:'same-origin'};
  if(opts.body!==undefined){if(opts.body instanceof Blob){o.body=opts.body}else{o.headers['content-type']='application/json';o.body=JSON.stringify(opts.body)}}
  var url=(MODE==='admin'?'/admin/api/':'/api/g/'+SLUG+'/')+chemin;
  if(APERCU)url+=(url.indexOf('?')<0?'?':'&')+'apercu=1';
  return fetch(url,o).then(function(r){return r.json().catch(function(){return {}}).then(function(j){if(!r.ok){var e=new Error(j.erreur||('Erreur '+r.status));e.status=r.status;throw e}return j})});
}
var ADM={dossiers:[],statut:'cachee',grille:'grande',fichiers:true,tri:'asc',quota:60,hd:true,web:true,albumActif:true,couvPos:'50% 50%',mur:true};
var DONNEES=null;                         // détail de la collection ouverte (vue photographe)
var minuteurSauve=null;
var CHAMPS=['nom','evenement','sansCode','classeur','dateEvt','statut','code','codeInvite','quota','prixSupp','supp','hd','hdInvite','web','albumActif','expiration','rappel','relanceAuto','relanceJours','couv','couvPos','mur','prefixe','dossiers','grille','fichiers','tri','contacts'];
function sauverAdm(immediat){
  if(MODE!=='admin'||!CID)return Promise.resolve();
  clearTimeout(minuteurSauve);
  return new Promise(function(ok){
    minuteurSauve=setTimeout(function(){
      var b={};CHAMPS.forEach(function(k){if(k in ADM)b[k]=k==='dossiers'?ADM.dossiers.map(function(d){return {id:d.id,nom:d.nom,desc:d.desc||''}}):ADM[k]});
      api('collections/'+CID,{method:'PATCH',body:b}).then(function(r){ok(r)}).catch(function(e){toast(e.message);ok(null)});
    },immediat?0:350);
  });
}
function journaliser(){}
function acteur(){return etat.invite?'Invité':'Couple'}
function depuis(ts){var s=(Date.now()-ts)/1e3;if(s<60)return 'à l’instant';if(s<3600)return 'il y a '+Math.floor(s/60)+' min';if(s<86400)return 'il y a '+Math.floor(s/3600)+' h';var j=Math.floor(s/86400);return j===1?'hier':'il y a '+j+' jours'}
function dateHeure(ts){var d=new Date(ts);return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})+' · '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
var QUOTA=60;
var DOSSIERS=ADM.dossiers;
var TOUTES=[];
var PHOTOS=[];
function recalc(){
  var idx={};DOSSIERS.forEach(function(d,i){idx[d.id]=i});
  PHOTOS=TOUTES.filter(function(p){return p.dossier in idx}).sort(function(x,y){return (idx[x.dossier]-idx[y.dossier])||(MODE==='admin'?(ADM.tri==='desc'?-1:1)*x.nom.localeCompare(y.nom,'fr',{numeric:true}):0)});
  DOSSIERS.forEach(function(d){d.n=PHOTOS.filter(function(p){return p.dossier===d.id}).length});
}
function prefixeDefaut(){return slugNom((ADM.nom||NOMDEF).replace(/^(Séance( (couple|famille|maternité|grossesse))?|Mariage|Famille|Maternité)\s+/i,''))}
function slugNom(s){return s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s*&\s*|\s+et\s+/gi,'-').replace(/[^A-Za-z0-9-]+/g,'-').replace(/-{2,}/g,'-').replace(/^-|-$/g,'')}
function prefixeFichiers(){return ADM.prefixe||prefixeDefaut()}
function parId(n){for(var i=0;i<TOUTES.length;i++)if(TOUTES[i].n===n)return TOUTES[i]}
var MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function dateFr(iso){if(!iso)return '';var d=new Date(iso+'T12:00:00');return d.getDate()+(d.getDate()===1?'er':'')+' '+MOIS[d.getMonth()]+' '+d.getFullYear()}
function nomDossier(id){for(var i=0;i<DOSSIERS.length;i++)if(DOSSIERS[i].id===id)return DOSSIERS[i].nom}
function poidsTotal(liste,web){var s=0;liste.forEach(function(p){s+=web?(p.web||0.6):p.mo});return s}
function fmtPoids(mo){return mo>=1000?(mo/1000).toFixed(1).replace('.',',')+' Go':Math.max(1,Math.round(mo))+' Mo'}
// Galerie d'événement : un seul code d'accès, textes adaptés (pas de « couple » ni de « mariage »)
function EVT(){if(SEANCE)return false;if(MODE!=='admin')return !!(COLLPUB&&COLLPUB.evenement);return ADM.evenement===undefined?ADM.classeur==='Événements':!!ADM.evenement}
function nomsCouple(nom){return String(nom||'').replace(/^(Mariage|Séance couple|Séance famille|Séance maternité|Séance|Famille)\s+/i,'')}

/* ---------- État du client ---------- */
var etat={listes:{'Mes favoris':[]},listeActive:'Mes favoris',album:[],verrou:false,notes:{},vue:'tout',idx:0,courante:[]};
function sauver(){}
function tousFavoris(){var s={};Object.keys(etat.listes).forEach(function(l){etat.listes[l].forEach(function(id){s[id]=1})});return s}
function estFav(id){return (etat.listes[etat.listeActive]||[]).indexOf(id)>-1}
function estAlbum(id){return etat.album.indexOf(id)>-1}

var $=function(id){return document.getElementById(id)};
function toast(t){var el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove('on')},3600)}

/* ---------- Côté client : chargement des données ---------- */
function chargerClient(){
  return api('donnees').then(function(d){
    PERM=d.perm;SEANCE=d.collection.type==='seance';majTxt();iconesMode();
    var c=d.collection;
    ADM={nom:c.nom,dateEvt:c.dateEvt,expiration:c.expiration,phase:c.phase,livre:c.livre||0,couv:c.couv,couvHd:c.couvHd||null,couvPos:c.couvPos||'50% 50%',quota:c.quota,prixSupp:c.prixSupp,supp:c.supp,
      dossiers:c.dossiers,albumActif:PERM.selection||LIVREC(c),hd:PERM.hd,hdInvite:PERM.hd,web:PERM.web,slug:c.slug,mur:COLLPUB?COLLPUB.mur:true};
    QUOTA=c.quota;DOSSIERS=ADM.dossiers;
    TOUTES=d.photos.map(function(p){return {id:p.id,n:p.id,nom:p.nom,dossier:p.dossier,w:p.w||3,h:p.h||2,mo:p.mo,web:p.web}});
    recalc();
    etat.listes=d.listes||{'Mes favoris':[]};if(!etat.listes[etat.listeActive])etat.listeActive='Mes favoris';
    etat.album=d.etat.album||[];etat.verrou=!!d.etat.verrou;etat.notes=d.etat.notes||{};
    etat.invite=PERM.role==='invite';
    $('galerie').classList.toggle('invite',etat.invite);
    $('galerie').classList.toggle('sans-dl',!PERM.telecharger);
    majNoms();majCouv();majExpiration();
    return d;
  });
}
function LIVREC(c){return c.type==='seance'&&c.phase==='livraison'}
function majNoms(){
  var n=nomsCouple(ADM.nom||(COLLPUB&&COLLPUB.nom)),parts=n.split(/\s*&\s*/);
  $('acces-nom').textContent=n;
  $('couv-nom').innerHTML=parts.length===2?esc(parts[0])+' <em>&amp;</em><br>'+esc(parts[1]):esc(n);
  document.title=n+' · Mélissa Siméon';
}

/* ---------- Accès ---------- */
// Galerie sans code : seul l'e-mail est demandé
if(COLLPUB&&COLLPUB.sansCode&&$('code')){$('code').closest('.champ').style.display='none'}
$('form-acces').addEventListener('submit',function(e){
  e.preventDefault();
  var em=$('email').value.trim(),c=$('code').value.trim(),b=this.querySelector('button[type=submit]');
  if(!/^\S+@\S+\.\S+$/.test(em)){$('err-acces').textContent='Indiquez votre adresse e-mail pour accéder à la galerie.';return}
  if(!c&&!(COLLPUB&&COLLPUB.sansCode)){$('err-acces').textContent='Saisissez votre code d’accès.';return}
  b.disabled=true;$('err-acces').textContent='';
  api('acces',{method:'POST',body:{email:em,code:c}}).then(function(r){
    return chargerClient().then(function(){
      ouvrirGalerie();guideALaConnexion(true);
      if(r.role==='invite')toast(PERM.hd?'Bienvenue ! Accès invité : photos en HD et en taille web.':'Bienvenue ! Accès invité : photos en taille web.');
    });
  }).catch(function(err){$('err-acces').textContent=err.message}).then(function(){b.disabled=false});
});
/* ---- Guide de la sélection (fenêtre à la connexion, rouvrable via « Comment ça marche ? ») ---- */
function guideActif(){return MODE==='client'&&!etat.invite&&modeChoix()==='album'&&!etat.verrou}
function cleGuide(){return 'guide-sel-'+SLUG}
/* Petites illustrations animées du guide (CSS pur, en boucle) : elles reprennent les vraies photos de la galerie */
function photosGuide(){
  var l=PHOTOS.filter(function(p){return p.h>p.w});if(l.length<4)l=PHOTOS.slice();
  return [0,1,2,3].map(function(i){var p=l[Math.floor(i*l.length/4)];return p?'background-image:url('+SRC(p.n,'mini')+')':''});
}
function illustration(t){
  var g=photosGuide(),cur='<span class="il-cur"><svg viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2 1.3L9.5 19z" fill="#fff" stroke="#2A2016" stroke-width="1.6" stroke-linejoin="round"/></svg></span>';
  var lib=SEANCE?['Sélectionner','Sélectionnée']:['Ajouter à l’album','Dans l’album'];
  if(t==='choix')return '<div class="il il-choix"><div class="il-ph" style="'+g[0]+'"><span class="il-badge"></span><span class="il-pill"><span class="a">+ '+lib[0]+'</span><span class="b">✓ '+lib[1]+'</span></span></div>'+cur+'</div>';
  if(t==='note')return '<div class="il il-note"><div class="il-ph" style="'+g[1]+'"><span class="il-badge on"></span><span class="il-npill">✎ Ajouter une note</span></div><span class="il-bulle"><span>Petite tache ici</span></span>'+cur+'</div>';
  if(t==='valider')return '<div class="il il-valider"><div class="il-barre"><div><b>Sélection</b><span class="il-jg"><i></i></span></div><span class="il-val">Valider</span></div><span class="il-ok">✓ Sélection envoyée</span>'+cur+'</div>';
  if(t==='livre')return '<div class="il il-livre"><div class="il-pages"><span class="s1"></span><span class="s2"></span><span class="s3"></span></div><span class="v v1" style="'+g[0]+'"></span><span class="v v2" style="'+g[1]+'"></span><span class="v v3" style="'+g[2]+'"></span></div>';
  if(t==='impression')return '<div class="il il-impr"><svg class="il-arc" viewBox="0 0 200 90"><path d="M14 74 Q100 -6 186 62" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 6" stroke-linecap="round"/></svg><span class="il-avion"><svg viewBox="0 0 24 24"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z" fill="currentColor"/></svg></span><span class="il-livreF" style="'+g[3]+'"><i></i></span><span class="il-ile">Martinique</span></div>';
  if(t==='retouche')return '<div class="il il-retouche"><div class="il-ph av" style="'+g[2]+'"></div><div class="il-ph ap" style="'+g[2]+'"></div><span class="il-trait"></span></div>';
  if(t==='livraison')return '<div class="il il-liv"><span class="il-env"><svg viewBox="0 0 48 34"><rect x="1.5" y="1.5" width="45" height="31" rx="4" fill="#fff" stroke="currentColor" stroke-width="2"/><path d="M3 4l21 15L45 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span><span class="il-sort" style="'+g[3]+'"><em>HD</em></span></div>';
  return '';
}
function guideSelection(){
  var etapes=SEANCE?[
    ['Votre sélection','Cliquez sur <b>« + Sélectionner »</b> en bas à droite de chaque photo que vous aimez. Votre formule en comprend <b>'+QUOTA+'</b>'+(ADM.supp!==false&&ADM.prixSupp?' ; au-delà, chaque photo supplémentaire est à '+ADM.prixSupp+' €':'')+'. Vous pouvez ajouter ou retirer des photos autant que vous le souhaitez.','choix'],
    ['Une demande ? Laissez une note','Sur une photo sélectionnée, touchez <b>« ✎ Ajouter une note »</b> (en bas à gauche de la photo, ou dans l’affichage en grand) pour me signaler un détail : une petite tache sur un vêtement, une imperfection passagère… Je la lirai avant la retouche.','note'],
    ['La validation','Une fois votre choix terminé, cliquez sur <b>« Valider »</b> dans la barre en bas de l’écran. C’est ce qui m’envoie votre sélection : sans cette étape, je ne la reçois pas !','valider'],
    ['La retouche','Je retouche ensuite chacune des photos choisies avec soin, en tenant compte de vos notes.','retouche'],
    ['La livraison','Vous recevez un e-mail dès qu’elles sont prêtes : vos photos retouchées apparaissent dans cette même galerie, en haute définition et sans filigrane.','livraison']
  ]:[
    ['Votre sélection','Cliquez sur <b>« + Ajouter à l’album »</b> en bas à droite de chaque photo que vous souhaitez voir dans votre livre. Vous pouvez en choisir jusqu’à <b>'+QUOTA+'</b>, et en ajouter ou retirer autant que vous le souhaitez.','choix'],
    ['La validation','Une jauge vous indique où vous en êtes. Une fois votre sélection terminée, pensez bien à cliquer sur <b>« Valider »</b> dans la barre en bas de l’écran : sans cette étape, je ne la reçois pas !','valider'],
    ['Ma mise en page','À partir de votre sélection, je construis le livre pour qu’il raconte votre journée comme une histoire.','livre'],
    ['L’impression','J’envoie ensuite le livre à l’impression. Les délais dépendent de l’imprimeur et de l’acheminement jusqu’en Martinique, je ne peux donc pas m’engager sur une date précise, mais je vous tiendrai informés à chaque étape.','impression']
  ];
  fenetre('<div class="guide-sel"><span class="etiquette">'+(SEANCE?'Votre sélection':'Votre livre photo')+'</span><h2>Comment se passe la sélection</h2>'+
    '<ol class="guide-etapes">'+etapes.map(function(e,i){return '<li><div class="ill">'+illustration(e[2])+'</div><div><b><i>'+(i+1)+'</i>'+e[0]+'</b><p>'+e[1]+'</p></div></li>'}).join('')+'</ol>'+
    '<div class="ligne-btn"><button class="btn" data-ferme>'+(SEANCE?'Commencer ma sélection':'Commencer ma sélection')+'</button></div></div>');
  $('fenetre').classList.add('guide-fen');
  try{localStorage.setItem(cleGuide(),'1')}catch(_){}
}
function guideALaConnexion(viaFormulaire){
  if(!guideActif()||APERCU&&!viaFormulaire)return;
  var vu=false;try{vu=!!localStorage.getItem(cleGuide())}catch(_){}
  if(viaFormulaire||!vu)setTimeout(guideSelection,400);
}
document.addEventListener('click',function(e){if(e.target.closest('[data-guide]')){e.preventDefault();guideSelection()}});
function appliquerAlbum(){$('galerie').classList.toggle('sans-album',albumOff());$('galerie').classList.toggle('seance-sel',SELP());$('vision').classList.toggle('seance-sel',SELP());majBandeau()}
function ouvrirGalerie(){
  appliquerAlbum();$('acces').hidden=true;$('galerie').hidden=false;window.scrollTo(0,0);rendre();agencer();
  var m=location.pathname.match(/\/photo\/(\d+)/);
  if(m){var i=etat.courante.findIndex(function(p){return p.id===+m[1]});if(i>-1)ouvrirVision(i)}
}

/* ---------- Couverture ---------- */
function majCouv(){
  var c=ADM.couv&&parId(ADM.couv)?ADM.couv:(PHOTOS[0]&&PHOTOS[0].n);
  var el=$('ph-couv'),hd=urlCouvHd(c);
  // Séance en sélection : les aperçus sont en basse qualité avec filigrane, la couverture est donc floutée (texte bien lisible)
  var cv=el.closest('.couverture');if(cv)cv.classList.toggle('couv-floue',SELP());
  // HD par-dessus, version web en dessous : la web s'affiche tout de suite, la HD la recouvre dès qu'elle est chargée
  el.style.background='#2A2117';
  if(c){el.style.backgroundImage=(hd?'url('+hd+'),':'')+'url('+SRC(c)+')';el.style.backgroundPosition=ADM.couvPos+(hd?','+ADM.couvPos:'');el.style.backgroundSize='cover';el.style.backgroundRepeat='no-repeat'}
}
// Adresse de la couverture HD si elle correspond bien à la photo affichée
function urlCouvHd(c){
  var hd=ADM.couvHd;if(!c||!hd||+hd.n!==+c)return null;
  if(MODE==='admin')return CID?'/admin/api/collections/'+CID+'/couverture?v='+hd.v:null;
  return SLUG?'/img/'+SLUG+'/couv?v='+hd.v+(APERCU?'&apercu=1':''):null;
}
function majDateEvt(){var s=SEANCE||(COLLPUB&&COLLPUB.type==='seance');document.querySelectorAll('.date-evt').forEach(function(e){e.textContent=(s?'Séance photo · ':EVT()?'Événement · ':'Mariage · ')+(ADM.dateEvt||(COLLPUB&&COLLPUB.dateEvt)?dateFr(ADM.dateEvt||COLLPUB.dateEvt):'')})}
function majMur(){
  var a=$('acces');if(!a)return;var off=ADM.mur===false||!SLUG;a.classList.toggle('sans-mur',off);if(off)return;
  var pi=a.querySelector('.amur-piste');if(pi&&!pi.dataset.ok){pi.dataset.ok=1;var im=new Image();im.onload=function(){pi.style.backgroundImage='url('+im.src+')';a.dataset.ratio=im.naturalWidth/im.naturalHeight;majMur()};im.onerror=function(){a.classList.add('sans-mur')};im.src='/img/'+SLUG+'/mur'}
  var r=+a.dataset.ratio||3600/698,h=(a.offsetHeight||window.innerHeight)+80,w=Math.round(r*h);a.style.setProperty('--mw',w+'px');a.style.setProperty('--md',Math.round(w/16)+'s');
}
window.addEventListener('resize',function(){majMur()});
function initOeil(){var b=$('code-oeil'),c=$('code');if(!b||b.dataset.ok)return;b.dataset.ok=1;b.innerHTML=I.oeil;
  b.onclick=function(){var v=c.type==='password';c.type=v?'text':'password';b.innerHTML=v?I.oeilBarre:I.oeil;var l=v?'Masquer le code':'Afficher le code';b.setAttribute('aria-label',l);b.title=l;b.setAttribute('aria-pressed',v);c.focus()}}
function majExpiration(){setTimeout(initOeil);if(MODE!=='client')return;majMur();majDateEvt();if(ADM.expiration)$('puce-exp').textContent=(SELP()?'Sélection ouverte jusqu’au ':'Disponible jusqu’au ')+dateFr(ADM.expiration)}
$('btn-voir').addEventListener('click',function(){document.querySelector('.barre').scrollIntoView({behavior:'smooth'})});

/* ---------- Onglets ---------- */
function rendreOnglets(){
  var h='<button class="onglet" data-v="tout">Tout<span class="num">'+photosClient().length+'</span></button>';
  // Une seule catégorie avec des photos : inutile de l'afficher à côté de « Tout »
  var pleins=DOSSIERS.filter(function(d){return d.n});
  if(!SEANCE&&pleins.length>1)DOSSIERS.forEach(function(d){if(d.n)h+='<button class="onglet" data-v="'+d.id+'">'+esc(d.nom)+'<span class="num">'+d.n+'</span></button>'});
  $('onglets').innerHTML=h;
  $('onglets').querySelectorAll('.onglet').forEach(function(b){
    b.setAttribute('aria-pressed',b.dataset.v===etat.vue);
    b.onclick=function(){etat.vue=b.dataset.v;rendre()};
  });
}

/* ---------- Mur ---------- */
var SV='<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
var COEUR='<path d="M12 20.3s-7.2-4.5-9.4-8.8C1 8.4 2.8 4.8 6.2 4.8c2.3 0 3.8 1.4 4.6 2.7h2.4c.8-1.3 2.3-2.7 4.6-2.7 3.4 0 5.2 3.6 3.6 6.7-2.2 4.3-9.4 8.8-9.4 8.8z"/>';
var I={
  coeur:SV+COEUR+'</svg>',
  coeurPlein:SV.replace('fill="none"','fill="currentColor"')+COEUR+'</svg>',
  album:SV+'<path d="M5 4.5h11.5a2 2 0 0 1 2 2V19.5H7a2 2 0 0 1-2-2z"/><path d="M5 17.5a2 2 0 0 1 2-2h11.5"/><path d="M9 4.5v6l2-1.4 2 1.4v-6"/></svg>',
  albumPlein:SV+'<path d="M5 4.5h11.5a2 2 0 0 1 2 2V19.5H7a2 2 0 0 1-2-2z" fill="currentColor" fill-opacity=".22"/><path d="M5 17.5a2 2 0 0 1 2-2h11.5"/><path d="M9 4.5v6l2-1.4 2 1.4v-6" fill="currentColor"/></svg>',
  dl:SV+'<path d="M12 4v11.5M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/></svg>',
  partage:SV+'<path d="M14 5l6 5.5-6 5.5V12.6c-5 0-8 1.3-10 5.4.6-5.6 3.6-9.2 10-9.8z"/></svg>',
  bulle:SV+'<path d="M12 4C7 4 3.5 7.3 3.5 11.3c0 2.2 1.1 4.2 2.9 5.5V20l3-1.7c.8.2 1.7.3 2.6.3 5 0 8.5-3.3 8.5-7.3S17 4 12 4z"/><path d="M8 12.5l2.6-2.6 2.4 1.8 2.9-2.8"/></svg>',
  tel:SV+'<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 .8c-1.2-.5-2.2-1.5-2.7-2.7l.8-1-1-2z"/></svg>',
  monde:SV+'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.3-3.5-8.5s1.1-6.1 3.5-8.5z"/></svg>',
  mail:SV+'<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
  x:SV+'<path d="M5 4.5l14 15M19 4.5l-14 15"/></svg>',
  epingle:SV+'<path d="M12 21v-6.5"/><path d="M8 3.5h8l-1.3 5 3 3.3H6.3l3-3.3z"/></svg>',
  arobase:SV+'<circle cx="12" cy="12" r="3.3"/><path d="M15.3 12v1.4a2.6 2.6 0 0 0 5.2 0V12A8.5 8.5 0 1 0 17 18.8"/></svg>',
  plus:SV+'<circle cx="6" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18" cy="12" r="1.3" fill="currentColor"/></svg>',
  fermer:SV+'<path d="M6 6l12 12M18 6L6 18"/></svg>',
  dossier:SV+'<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.3A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg>',
  caret:SV+'<path d="M7 10l5 5 5-5"/></svg>',
  replier:SV+'<path d="M5 4.5v15M20 12H9.5M13.5 8l-4 4 4 4"/></svg>',
  sortie:SV+'<path d="M14 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5H14M10.5 12H20M16.5 8.5 20 12l-3.5 3.5"/></svg>',
  deplier:SV+'<path d="M19 4.5v15M4 12h10.5M10.5 8l4 4-4 4"/></svg>',
  etoile:SV+'<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/></svg>',
  etoilePleine:SV.replace('fill="none"','fill="currentColor"')+'<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/></svg>',
  ecran:SV+'<rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/><path d="M3.5 8.5h17"/></svg>',
  loupe:SV+'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/></svg>',
  liste:SV+'<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11"/><circle cx="4.8" cy="6.5" r=".9" fill="currentColor"/><circle cx="4.8" cy="12" r=".9" fill="currentColor"/><circle cx="4.8" cy="17.5" r=".9" fill="currentColor"/></svg>',
  kebab:SV+'<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/></svg>',
  envoyer:SV+'<path d="M4 4.5l16.5 7.5L4 19.5l2.8-7.5z"/><path d="M6.8 12h13.7"/></svg>',
  oeilBarre:SV+'<path d="M2.5 12S6 5.5 12 5.5c2 0 3.7.7 5.1 1.7M21.5 12s-3.5 6.5-9.5 6.5c-2 0-3.7-.7-5.1-1.7"/><path d="M4 20L20 4"/></svg>',
  oeil:SV+'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  sortir:SV+'<path d="M14 4.5h4.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  check:SV+'<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  croix:SV+'<path d="M12 5v14M5 12h14"/></svg>',
  image:SV+'<rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5.5-5 3.5 3 2.5-2 4.5 4"/></svg>',
  activite:SV+'<path d="M4 19.5V10M9.3 19.5V5M14.6 19.5v-7M20 19.5V8"/></svg>',
  reglages:SV+'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  plusRond:SV+'<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  poignee:SV+'<path d="M5 9.5h14M5 14.5h14"/></svg>',
  points:SV+'<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/></svg>',
  calendrier:SV+'<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  tel:SV+'<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3A2 2 0 0 1 18 19.5 15.5 15.5 0 0 1 4.5 6 2 2 0 0 1 6.5 4z"/></svg>',
  boite:SV+'<path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1 2h5l1-2H20"/></svg>',
  crayon:SV+'<path d="M15.5 5l3.5 3.5L9 18.5H5.5V15z"/><path d="M13.5 7l3.5 3.5"/></svg>',
  haut:SV+'<path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  bas:SV+'<path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  corbeille:SV+'<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.2 10.5v6M13.8 10.5v6"/></svg>',
  tri:SV+'<path d="M7 4.5v15M3.5 16l3.5 3.5 3.5-3.5M13 6h7M13 10.5h5M13 15h3"/></svg>',
  grille:SV+'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 4v16M4 12h16"/></svg>',
  ajout:SV+'<path d="M12 15.5V5M7.5 9.5L12 5l4.5 4.5M5 19.5h14"/></svg>',
  lien:SV+'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/></svg>',
  historique:SV+'<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9M12 8v4.5l3 2"/></svg>',
  deplacer:SV+'<path d="M4 12h12M11.5 7.5L16 12l-4.5 4.5M20 5v14"/></svg>',
  dupliquer:SV+'<rect x="8.5" y="8.5" width="11" height="11" rx="1.8"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg>',
  style:SV+'<path d="M5 19L15.5 8.5M14 4.5v2M18.5 9h2M17.2 5.8l1.4-1.4M12.5 4.5l-.8.8M19.5 11.5l-.8.8"/></svg>',
  retour:SV+'<path d="M19.5 12H5M11 6l-6 6 6 6"/></svg>',
  g:SV+'<path d="M15 5l-7 7 7 7"/></svg>',
  d:SV+'<path d="M9 5l7 7-7 7"/></svg>',
  hd:SV+'<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M7.5 9.5v5M7.5 12h3M10.5 9.5v5M13.5 9.5v5h1.5a2.5 2.5 0 0 0 0-5z"/></svg>',
  web:SV+'<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 18h2"/></svg>'
};
I.livre=I.album;I.livrePlein=I.albumPlein;
I.cercle=SV+'<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>';I.cerclePlein=SV+'<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M7.8 12.4l2.9 2.9 5.6-5.7" stroke="#FBF8F4" stroke-width="2"/></svg>';
function iconesMode(){I.album=SEANCE?I.cercle:I.livre;I.albumPlein=SEANCE?I.cerclePlein:I.livrePlein;if($('btn-album'))poserIco('btn-album',I.album)}
function poserIco(id,ico){var b=$(id),bd=b.querySelector('.badge');b.innerHTML=ico;if(bd)b.appendChild(bd)}
poserIco('btn-fav',I.coeur);poserIco('btn-album',I.album);poserIco('btn-dl',I.dl);poserIco('btn-partage',I.partage);
poserIco('v-fermer',I.retour);poserIco('v-dl',I.dl);poserIco('v-partage',I.partage);poserIco('v-croix',I.fermer);poserIco('v-prec',I.g);poserIco('v-suiv',I.d);

function photosClient(){return SELP()&&etat.verrou?PHOTOS.filter(function(p){return estAlbum(p.id)}):PHOTOS}
function photosVue(){
  if(etat.vue==='fav')return PHOTOS.filter(function(p){return estFav(p.id)});
  if(etat.vue==='album')return PHOTOS.filter(function(p){return estAlbum(p.id)});
  if(etat.vue==='tout')return photosClient();
  return PHOTOS.filter(function(p){return p.dossier===etat.vue});
}
function rendre(surPlace){
  if(['tout','fav','album'].indexOf(etat.vue)<0){var dv=dossierPar(etat.vue);if(!dv||!dv.n)etat.vue='tout'}
  if(LIVRE()&&etat.vue==='album')etat.vue='tout';
  if(SEANCE)majBandeau();
  $('meta-nb').textContent=SEANCE?(SELP()?(etat.verrou?photosClient().length+' photos sélectionnées':PHOTOS.length+' photos à découvrir'):PHOTOS.length+' photos retouchées'):(function(n){return PHOTOS.length+' photos'+(n>1?' · '+n+' catégories':'')})(DOSSIERS.filter(function(d){return d.n}).length);
  rendreOnglets();
  $('btn-fav').setAttribute('aria-pressed',etat.vue==='fav');
  $('btn-album').setAttribute('aria-pressed',etat.vue==='album');
  var nf=Object.keys(tousFavoris()).length;
  $('nb-fav').textContent=nf||'';$('nb-album').textContent=etat.album.length||'';
  poserIco('btn-fav',nf?I.coeurPlein:I.coeur);poserIco('btn-album',etat.album.length?I.albumPlein:I.album);
  var liste=photosVue();etat.courante=liste;
  var t,st;
  if(etat.vue==='fav'){t='Vos favoris';st=liste.length+' photo'+(liste.length>1?'s':'')+' dans « '+etat.listeActive+' »'}
  else if(etat.vue==='album'){t=SEANCE?'Ma sélection':'Sélection pour l’album';st=etat.verrou?(SEANCE?'Sélection envoyée à Mélissa':'Sélection validée et envoyée à Mélissa'):(SEANCE?liste.length+' photo'+(liste.length>1?'s':'')+' choisie'+(liste.length>1?'s':'')+' · '+QUOTA+' incluses dans votre formule':liste.length+' sur '+QUOTA+' photos choisies')}
  else if(etat.vue==='tout'){t=SELP()?'Vos photos':'Toutes les photos';st=SELP()?(etat.verrou?etat.album.length+' photo'+(etat.album.length>1?'s sélectionnées':' sélectionnée'):liste.length+' aperçus filigranés · choisissez celles à retoucher'):liste.length+' photos · '+fmtPoids(poidsTotal(liste))+' en HD'}
  else{t=nomDossier(etat.vue);st=liste.length+' photos · '+fmtPoids(poidsTotal(liste))+' en HD'}
  var dd=dossierPar(etat.vue);$('desc-vue').hidden=!(dd&&dd.desc);$('desc-vue').textContent=dd&&dd.desc?dd.desc:'';
  $('titre-vue').textContent=t;$('sous-titre-vue').textContent=st;
  rendreListes();
  if(!liste.length){
    $('colonnes').innerHTML='';$('colonnes').style.height='';
    var v=document.createElement('div');v.className='vide';
    v.innerHTML=etat.vue==='fav'?'<h3>Aucun favori pour l’instant</h3><span>Touchez le cœur sur une photo pour l’ajouter à cette liste.</span>':SEANCE?'<h3>Aucune photo sélectionnée</h3><span>Cliquez sur le bouton <b>« + Sélectionner »</b> en bas à droite d’une photo pour la choisir. Votre formule en comprend '+QUOTA+'.</span><button class="btn clair" data-guide>Comment ça marche ?</button>':'<h3>L’album est vide</h3><span>Cliquez sur le bouton <b>« + Ajouter à l’album »</b> en bas à droite d’une photo pour la proposer pour votre livre. Vous pouvez en choisir '+QUOTA+'.</span><button class="btn clair" data-guide>Comment ça marche ?</button>';
    $('colonnes').appendChild(v);
  }else if(surPlace&&memesPhotos(liste)){
    // Même liste qu'avant : on met à jour les boutons de chaque photo sans recharger les images (pas de clignotement)
    [].slice.call($('colonnes').querySelectorAll('.tuile')).forEach(function(t){
      var p=liste[+t.dataset.i];if(!p)return;var f=estFav(p.id),a=estAlbum(p.id),ch=a&&modeChoix()==='album';
      if(t.dataset.etat===String(f)+a+!!etat.notes[p.id]+etat.verrou)return;
      t.classList.toggle('choisie',ch);
      [].slice.call(t.children).forEach(function(c){if(!c.classList.contains('ph'))c.remove()});
      t.insertAdjacentHTML('beforeend',interieurTuile(p,f,a));t.dataset.etat=String(f)+a+!!etat.notes[p.id]+etat.verrou;
    });
  }else{
    var h='';
    liste.forEach(function(p,i){
      var f=estFav(p.id),a=estAlbum(p.id);
      h+='<figure class="tuile'+(a&&modeChoix()==='album'?' choisie':'')+'" data-i="'+i+'" data-r="'+(p.w/p.h).toFixed(4)+'" tabindex="0" aria-label="'+p.nom+'">'+
        '<img class="ph" loading="lazy" decoding="async" src="'+SRC(p.n,'mini')+'" srcset="'+SRC(p.n,'mini')+' 800w, '+SRC(p.n,'web')+' 2048w" sizes="33vw" alt="">'+
        interieurTuile(p,f,a)+'</figure>';
    });
    $('colonnes').innerHTML=h;
    agencer();
  }
  if(liste.length)$('colonnes').dataset.ids=liste.map(function(p){return p.id}).join(',');else delete $('colonnes').dataset.ids;
  rendreBarreSel();
}
function memesPhotos(l){return $('colonnes').dataset.ids===l.map(function(p){return p.id}).join(',')&&$('colonnes').querySelectorAll('.tuile').length===l.length}
function interieurTuile(p,f,a){
  return '<div class="etats">'+(f?'<span title="Dans vos favoris">'+I.coeurPlein+'</span>':'')+'</div>'+
    boutonChoix(p,f,a)+boutonNote(p,a)+
    '<div class="outils">'+
    (modeChoix()==='fav'?'':'<button class="tbtn" data-act="fav" data-id="'+p.id+'" title="'+(f?'Retirer des favoris':'Ajouter aux favoris')+'" aria-label="Favori" aria-pressed="'+f+'">'+(f?I.coeurPlein:I.coeur)+'</button>')+
    '<button class="tbtn" data-act="dl" data-id="'+p.id+'" title="Télécharger" aria-label="Télécharger" aria-haspopup="menu">'+I.dl+'</button>'+
    '<button class="tbtn" data-act="partage" data-id="'+p.id+'" title="Partager" aria-label="Partager" aria-haspopup="dialog">'+I.partage+'</button>'+
    '</div>';
}
/* Mosaïque en colonnes : chaque photo garde son format, rangée dans la colonne la plus courte.
   Le client choisit la taille d'affichage : petit, moyen (par défaut) ou grand. */
var largeurPrec=0,TAILLES={petit:'Petit',moyen:'Moyen',grand:'Grand'};
var TAILLE=(function(){try{var t=localStorage.getItem('taille-photos');return TAILLES[t]?t:'moyen'}catch(e){return 'moyen'}})();
function colonnesPour(W){
  if(TAILLE==='petit')return W>=1300?6:W>=1000?5:W>=700?4:3;
  if(TAILLE==='grand')return W>=1100?2:1;
  return W>=900?3:2;
}
function agencer(){
  var c=$('colonnes'),W=c.clientWidth;if(!W)return;largeurPrec=W;
  var n=colonnesPour(W),gap=W<560?(TAILLE==='petit'?4:8):(TAILLE==='petit'?12:Math.round(Math.min(48,Math.max(20,W*.024))));
  var cw=(W-gap*(n-1))/n,hauts=[];for(var k=0;k<n;k++)hauts.push(0);
  [].slice.call(c.querySelectorAll('.tuile')).forEach(function(t){
    var col=hauts.indexOf(Math.min.apply(null,hauts)),h=Math.round(cw/(+t.dataset.r||1.5));
    t.style.width=Math.floor(cw)+'px';t.style.height=h+'px';t.style.left=Math.round(col*(cw+gap))+'px';t.style.top=hauts[col]+'px';
    var im=t.querySelector('.ph');if(im)im.sizes=Math.ceil(cw)+'px';
    hauts[col]+=h+gap;
  });
  c.style.height=Math.max(0,Math.max.apply(null,hauts)-gap)+'px';
}
function choisirTaille(t){TAILLE=t;try{localStorage.setItem('taille-photos',t)}catch(e){}agencer();majBtnTaille()}
function majBtnTaille(){var b=$('btn-taille');if(b){b.title='Taille des photos : '+TAILLES[TAILLE].toLowerCase();b.setAttribute('aria-label',b.title)}}
if($('btn-taille')){
  poserIco('btn-taille',I.grille);majBtnTaille();
  $('btn-taille').onclick=function(e){e.stopPropagation();pop(this,'<div class="pop-label">Taille des photos</div>'+Object.keys(TAILLES).map(function(k){return itemPop(k,null,TAILLES[k],TAILLE===k)}).join(''),function(m){
    m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){choisirTaille(b.dataset.a);fermerPop()}})})};
}
if(window.ResizeObserver){new ResizeObserver(function(){if($('colonnes').clientWidth!==largeurPrec)agencer()}).observe($('colonnes'))}
else window.addEventListener('resize',agencer);

function rendreListes(){
  var z=$('zone-listes');
  if(etat.vue!=='fav'){z.hidden=true;return}
  z.hidden=false;
  var h='<div class="listes">';
  Object.keys(etat.listes).forEach(function(l){h+='<button class="onglet" data-l="'+l.replace(/"/g,'&quot;')+'" aria-pressed="'+(l===etat.listeActive)+'">'+l+'<span class="num">'+etat.listes[l].length+'</span></button>'});
  h+='<button class="onglet" id="nouvelle-liste">+ Nouvelle liste</button></div>';
  z.innerHTML=h;
  z.querySelectorAll('[data-l]').forEach(function(b){b.onclick=function(){etat.listeActive=b.dataset.l;sauver();rendre()}});
  $('nouvelle-liste').onclick=fenetreListe;
}
$('colonnes').addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');
  if(b){e.stopPropagation();if(b.dataset.act==='dl'){ouvrirMenu(b,parId(+b.dataset.id));return}if(b.dataset.act==='partage'){ouvrirPartage(parId(+b.dataset.id));return}if(b.dataset.act==='note'){fenetreNote(+b.dataset.id);return}basculer(b.dataset.act,+b.dataset.id);return}
  var t=e.target.closest('.tuile');if(t)ouvrirVision(+t.dataset.i);
});
$('colonnes').addEventListener('keydown',function(e){var t=e.target.closest('.tuile');if(t&&e.key==='Enter')ouvrirVision(+t.dataset.i)});

// Bouton toujours visible, avec libellé, en bas à droite de chaque photo : sélection (album / séance) ou favori
function modeChoix(){return !albumOff()&&!etat.invite?'album':!etat.invite?'fav':null}
function libelleChoix(m,on){
  if(m==='album')return SEANCE?(on?'Sélectionnée':'Sélectionner'):(on?'Dans l’album':'Ajouter à l’album');
  return on?'En favori':'Favori';
}
function boutonChoix(p,f,a){
  var m=modeChoix();if(!m)return '';
  var on=m==='album'?a:f;
  if(m==='album'&&etat.verrou&&!on)return '';
  var ico=m==='album'?(on?I.check:I.croix):(on?I.coeurPlein:I.coeur);
  return '<button class="tchoix'+(on?' on':'')+(m==='fav'?' fav':'')+'" data-act="'+m+'" data-id="'+p.id+'" aria-pressed="'+on+'"'+(m==='album'&&etat.verrou?' disabled':'')+' title="'+(m==='album'?(on?TXT.retirer:TXT.ajouter):(on?'Retirer des favoris':'Ajouter aux favoris'))+'">'+ico+'<span>'+libelleChoix(m,on)+'</span></button>';
}
function noteDispo(){return SELP()&&!etat.invite}
function boutonNote(p,a){
  if(!noteDispo())return '';var nt=etat.notes[p.id];
  if(!a&&!nt)return '';if(etat.verrou&&!nt)return '';
  return '<button class="tnote'+(nt?' on':'')+'" data-act="note" data-id="'+p.id+'" title="'+(nt?'Voir ma note pour Mélissa':'Laisser une note à Mélissa pour cette photo')+'">'+I.crayon+'<span class="lg">'+(nt?'Ma note':'Ajouter une note')+'</span><span class="ct">'+(nt?'Ma note':'Note')+'</span></button>';
}
function basculer(act,id){
  if(APERCU){toast('Aperçu : vos clics ne sont pas enregistrés.');return}
  var avant=JSON.stringify({l:etat.listes,a:etat.album});
  function reafficher(){var y=window.scrollY;rendre(true);window.scrollTo(0,y);if(!$('vision').hidden)majVision()}
  function annuler(e){var x=JSON.parse(avant);etat.listes=x.l;etat.album=x.a;reafficher();toast(e.message)}
  if(act==='fav'){
    var l=etat.listes[etat.listeActive],i=l.indexOf(id),on=i<0;
    if(on){l.push(id);toast('Ajoutée à « '+etat.listeActive+' »')}else l.splice(i,1);
    reafficher();
    api('favori',{method:'POST',body:{liste:etat.listeActive,photoId:id,on:on}}).catch(annuler);
  }else{
    if(etat.verrou){toast('Votre sélection est envoyée. Écrivez à Mélissa pour la modifier.');return}
    var j=etat.album.indexOf(id),on2=j<0;
    if(on2){
      if(etat.album.length>=QUOTA){if(!SEANCE||ADM.supp===false){toast(SEANCE?'Votre formule comprend '+QUOTA+' photos. Retirez-en une pour en choisir une autre.':'Vous avez atteint les '+QUOTA+' photos de votre album. Retirez-en une pour en ajouter une autre.');return}toast('Photo supplémentaire : '+ADM.prixSupp+' €')}
      etat.album.push(id);
      if(noteDispo()){var cleN='astuce-note-'+SLUG,vu=false;try{vu=!!localStorage.getItem(cleN);localStorage.setItem(cleN,'1')}catch(_){}if(!vu)setTimeout(function(){toast('Photo sélectionnée. Une demande particulière ? Touchez « ✎ Ajouter une note » sur la photo.')},250)}
    }else etat.album.splice(j,1);
    reafficher();
    api('album',{method:'POST',body:{photoId:id,on:on2}}).catch(annuler);
  }
}
$('btn-fav').onclick=function(){etat.vue=etat.vue==='fav'?'tout':'fav';rendre();document.querySelector('.barre').scrollIntoView()};
$('btn-album').onclick=function(){etat.vue=etat.vue==='album'?'tout':'album';rendre();document.querySelector('.barre').scrollIntoView()};

/* ---------- Barre de sélection ---------- */
function rendreBarreSel(){
  var n=etat.album.length,b=$('barre-sel');
  b.hidden=etat.verrou||albumOff()||!!etat.invite||!$('vision').hidden;
  if(SEANCE){var k=Math.max(0,n-QUOTA);
    $('sel-txt').innerHTML=k?'Ma sélection · '+n+' photos<small>'+QUOTA+' incluses + '+k+' en supplément · '+prix(k)+'</small>':'Ma sélection · '+n+' / '+QUOTA+' photos<small>incluses dans votre formule</small>';
    $('sel-jauge').classList.toggle('depasse',k>0);
  }else $('sel-txt').textContent='Sélection album · '+n+' / '+QUOTA+' photo'+(QUOTA>1?'s':'');
  $('sel-jauge').style.width=Math.min(100,n/QUOTA*100)+'%';
  $('btn-valider').textContent='Valider';$('btn-valider').disabled=n===0;
  $('btn-valider').title=n===0?(SEANCE?'Sélectionnez des photos pour pouvoir valider':'Ajoutez des photos à l’album pour pouvoir valider'):'';
}
$('btn-valider').onclick=function(){
  if(etat.verrou){etat.vue='album';rendre();return}
  if(SEANCE){validerSeance();return}
  var n=etat.album.length,reste=QUOTA-n;
  fenetre('<h2>Valider la sélection ?</h2><p>Vous avez choisi <b class="num">'+n+'</b> photo'+(n>1?'s':'')+' pour votre album'+(reste>0?', il vous en reste '+reste+' à choisir':'')+'. Une fois validée, la sélection est verrouillée et Mélissa la reçoit pour commencer la mise en page.</p><div class="ligne-btn"><button class="btn clair" data-ferme>Continuer à choisir</button><button class="btn" id="ok-valider">Valider ma sélection</button></div>');
  $('ok-valider').onclick=function(){var b=this;b.disabled=true;api('valider',{method:'POST',body:{}}).then(function(r){etat.verrou=true;fermerFenetre();rendre();toast('Merci ! Votre sélection est validée et Mélissa vient d’être prévenue.')}).catch(function(e){b.disabled=false;toast(e.message)})};
};

/* ---------- Visionneuse ---------- */
function ouvrirVision(i){fermerMenu();$('vision').classList.toggle('vision-sans-album',albumOff());$('vision').classList.toggle('seance-sel',SELP());$('v-note').hidden=!SELP()||!!etat.invite;$('vision').classList.toggle('vision-invite',!!etat.invite);etat.idx=i;$('vision').hidden=false;document.body.style.overflow='hidden';majVision();$('barre-sel').hidden=true;$('v-fermer').focus()}
function fermerVision(){fermerMenu();$('vision').hidden=true;document.body.style.overflow='';var tu=document.querySelector('#colonnes .tuile[data-i="'+etat.idx+'"]');if(tu){tu.scrollIntoView({block:'center'});tu.focus({preventScroll:true})}rendreBarreSel()}
var VCACHE={};
function majVision(){
  var p=etat.courante[etat.idx];if(!p){fermerVision();return}
  // Affichage immédiat : la miniature (déjà chargée dans la grille) s'affiche tout de suite, la version web la remplace dès qu'elle est prête
  var ph=$('v-ph'),web=SRC(p.n),idx=etat.idx;ph.alt=p.nom;
  if(VCACHE[web]){ph.src=web}else{ph.src=SRC(p.n,'mini');var im=new Image();im.onload=function(){VCACHE[web]=1;if(etat.idx===idx&&!$('vision').hidden)ph.src=web};im.src=web}
  // Préchargement des photos voisines pour un défilement fluide au clavier
  [1,2,-1].forEach(function(d){var q=etat.courante[(etat.idx+d+etat.courante.length)%etat.courante.length];if(q){var u=SRC(q.n);if(!VCACHE[u]){var i2=new Image();i2.onload=function(){VCACHE[u]=1};i2.src=u}}});
  if(SEANCE){var nt=!!etat.notes[p.id];$('v-note').innerHTML=I.crayon+'<span>'+(nt?'Ma note':'Ajouter une note')+'</span>';$('v-note').classList.toggle('on',nt);$('v-note').setAttribute('aria-pressed',nt);$('v-note').title=nt?'Voir ma note pour Mélissa':'Laisser une note à Mélissa pour cette photo';$('v-note').hidden=!SELP()||!!etat.invite||(etat.verrou&&!nt)}
  $('v-info').innerHTML=p.nom+(SEANCE?'':' · '+nomDossier(p.dossier))+' · <span class="num">'+(etat.idx+1)+' / '+etat.courante.length+'</span>';
  var f=estFav(p.id),a=estAlbum(p.id);
  $('v-fav').innerHTML=(f?I.coeurPlein:I.coeur)+'<span>'+libelleChoix('fav',f)+'</span>';$('v-fav').setAttribute('aria-pressed',f);$('v-fav').title=f?'Retirer des favoris':'Ajouter aux favoris';
  $('v-album').innerHTML=(a?I.check:I.croix)+'<span>'+libelleChoix('album',a)+'</span>';$('v-album').setAttribute('aria-pressed',a);$('v-album').title=a?TXT.retirer:TXT.ajouter;$('v-album').classList.toggle('on',a);var vc=$('v-ph').parentNode;if(vc)vc.classList.toggle('choisie',a&&modeChoix()==='album');$('v-fav').classList.toggle('on',f);
}
function nav(d){etat.idx=(etat.idx+d+etat.courante.length)%etat.courante.length;majVision()}
$('v-prec').onclick=function(){nav(-1)};$('v-suiv').onclick=function(){nav(1)};$('v-fermer').onclick=fermerVision;$('v-croix').onclick=fermerVision;
$('v-fav').onclick=function(){basculer('fav',etat.courante[etat.idx].id)};
$('v-album').onclick=function(){basculer('album',etat.courante[etat.idx].id)};
$('v-note').onclick=function(){fenetreNote(etat.courante[etat.idx].id)};
document.addEventListener('contextmenu',function(e){if(MODE==='client'&&SELP()&&e.target.tagName==='IMG')e.preventDefault()});
$('v-dl').onclick=function(e){e.stopPropagation();ouvrirMenu($('v-dl'),etat.courante[etat.idx])};

/* ---------- Partage ---------- */
var DOMAINE=location.host+'/';
function urlGalerie(){return location.protocol+'//'+DOMAINE+ADM.slug}
function slugifier(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'-et-').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-').slice(0,60)}
function ouvrirPartage(photo){
  fermerMenu();
  var lien=photo?urlGalerie()+'/photo/'+photo.n:urlGalerie();
  var nc=nomsCouple(ADM.nom),texte=SEANCE?(photo?'Une photo de notre séance avec Mélissa Siméon':'Les photos de notre séance avec Mélissa Siméon'):photo?'Une photo du mariage de '+nc:'Les photos du mariage de '+nc;if(EVT())texte=photo?'Une photo de '+ADM.nom:'Les photos de '+ADM.nom;
  if(!APERCU)api('partage',{method:'POST',body:{photo:!!photo}}).catch(function(){});
  var u=encodeURIComponent(lien),tx=encodeURIComponent(texte);
  $('partage-titre').textContent=photo?'Partager cette photo':'Partager la galerie';
  $('partage-sous').textContent=photo?photo.nom:'Envoyez le lien à vos proches pour qu’ils découvrent vos photos.';
  $('partage-lien').value=lien;
  var R=[
    ['Messenger',I.bulle,'fb-messenger://share/?link='+u],
    ['WhatsApp',I.tel,'https://wa.me/?text='+tx+'%20'+u],
    ['Facebook',I.monde,'https://www.facebook.com/sharer/sharer.php?u='+u],
    ['E-mail',I.mail,'mailto:?subject='+tx+'&body='+tx+'%0A'+u],
    ['X',I.x,'https://x.com/intent/post?text='+tx+'&url='+u],
    ['Pinterest',I.epingle,'https://www.pinterest.com/pin/create/button/?url='+u+'&description='+tx],
    ['Threads',I.arobase,'https://www.threads.net/intent/post?text='+tx+'%20'+u],
    ['Plus',I.plus,'']
  ];
  $('partage-reseaux').innerHTML=R.map(function(r){
    return r[2]?'<a class="reseau" href="'+r[2]+'" target="_blank" rel="noopener"><span>'+r[1]+'</span>'+r[0]+'</a>'
               :'<button class="reseau" id="partage-plus" type="button"><span>'+r[1]+'</span>'+r[0]+'</button>';
  }).join('');
  $('partage-note').textContent=COLLPUB&&COLLPUB.sansCode?'Le lien suffit : aucun code n’est demandé, seulement une adresse e-mail.':EVT()?'Les personnes avec qui vous partagez le lien devront saisir le code d’accès de la galerie.':etat.invite?'Vos proches devront saisir le code invité pour voir les photos.':'Vos proches devront saisir le code invité, que vous trouverez dans l’e-mail de Mélissa.';
  $('partage-plus').onclick=function(){
    if(navigator.share){navigator.share({title:texte,url:lien}).catch(function(){})}
    else toast('Sur téléphone, ce bouton ouvre le menu de partage du téléphone (SMS, Instagram, AirDrop…).');
  };
  $('voile-partage').hidden=false;$('partage-copier').focus();
}
function fermerPartage(){$('voile-partage').hidden=true}
poserIco('partage-fermer',I.fermer);
$('partage-fermer').onclick=fermerPartage;
$('voile-partage').addEventListener('click',function(e){if(e.target===$('voile-partage'))fermerPartage()});
$('partage-copier').onclick=function(){
  var inp=$('partage-lien'),b=this;
  function ok(){b.textContent='Copié';setTimeout(function(){b.textContent='Copier'},1800)}
  function repli(){inp.focus();inp.select();toast('Lien sélectionné : faites Copier (Cmd+C ou Ctrl+C).')}
  try{navigator.clipboard.writeText(inp.value).then(ok,repli)}catch(e){repli()}
};
$('btn-partage').onclick=function(e){e.stopPropagation();ouvrirPartage(null)};
// Bouton « revenir en haut » : apparaît une fois la couverture dépassée, se place au-dessus de la barre de sélection
if($('remonter')){(function(){
  var b=$('remonter');b.innerHTML=I.haut;var vis=false;
  function maj(){
    var on=!$('galerie').hidden&&scrollY>innerHeight*.9;
    if(on!==vis){vis=on;if(on)b.hidden=false;requestAnimationFrame(function(){b.classList.toggle('visible',on)});if(!on)setTimeout(function(){if(!vis)b.hidden=true},250)}
    // Barre de sélection de l'album visible : le bouton se place juste au-dessus, aligné à droite de la barre
    var sel=$('barre-sel'),h=0,droite='';
    if(sel&&!sel.hidden&&sel.getClientRects().length){var r=sel.getBoundingClientRect();if(r.height&&r.right>innerWidth-80){h=innerHeight-r.top;droite=Math.max(8,innerWidth-r.right)+'px'}}
    b.style.bottom=h?(h+10)+'px':'';b.style.right=droite;
  }
  addEventListener('scroll',maj,{passive:true});addEventListener('resize',maj);
  var bs=$('barre-sel');if(bs&&window.MutationObserver)new MutationObserver(function(){setTimeout(maj,30)}).observe(bs,{attributes:true,attributeFilter:['hidden','class','style'],childList:true,subtree:true});
  if(bs&&window.ResizeObserver)new ResizeObserver(maj).observe(bs);
  b.onclick=function(){scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
})()}
// Déconnexion du client ou de l'invité : retour à la page de connexion de la galerie
if($('btn-sortie')){poserIco('btn-sortie',I.sortie);$('btn-sortie').onclick=function(){
  if(APERCU){toast('Aperçu : la déconnexion est désactivée.');return}
  this.disabled=true;
  fetch('/api/g/'+SLUG+'/deconnexion',{method:'POST',credentials:'same-origin'}).catch(function(){}).then(function(){location.replace('/'+SLUG)});
}}
$('v-partage').onclick=function(e){e.stopPropagation();ouvrirPartage(etat.courante[etat.idx])};

/* ---------- Menu de téléchargement ---------- */
var menuPortee='tout';
function fermerMenu(){$('menu').hidden=true;document.querySelectorAll('[aria-expanded="true"]').forEach(function(b){b.setAttribute('aria-expanded','false')})}
function listePortee(v){return v==='tout'?PHOTOS:v==='fav'?PHOTOS.filter(function(p){return tousFavoris()[p.id]}):v==='album'?PHOTOS.filter(function(p){return estAlbum(p.id)}):PHOTOS.filter(function(p){return p.dossier===v})}
function ouvrirMenu(btn,photo){
  var m=$('menu'),cle=photo?String(photo.id):'galerie';
  if(!m.hidden&&m.dataset.pour===cle){fermerMenu();return}
  m.dataset.pour=cle;
  if(!photo)menuPortee=(DOSSIERS.some(function(d){return d.id===etat.vue})||etat.vue==='fav'||etat.vue==='album')?etat.vue:'tout';
  function construire(){
    var liste=photo?[photo]:listePortee(menuPortee),n=liste.length;
    var hd=photo?String(photo.mo).replace('.',',')+' Mo':fmtPoids(poidsTotal(liste)),web=photo?'≈ '+String(photo.web||0.6).replace('.',',')+' Mo':'≈ '+fmtPoids(poidsTotal(liste,true));
    var h='<h3>'+(photo?'Télécharger cette photo':'Télécharger')+'</h3>';
    if(!photo){
      var ch=[['tout','Toute la galerie']];
      DOSSIERS.forEach(function(d){if(d.id===etat.vue)ch.push([d.id,d.nom])});
      if(Object.keys(tousFavoris()).length)ch.push(['fav','Mes favoris']);
      if(etat.album.length&&!albumOff())ch.push(['album',SEANCE?'Ma sélection':'Ma sélection album']);
      h+='<div class="portee" role="group" aria-label="Photos à télécharger">'+ch.map(function(c){return '<button class="chip" data-portee="'+c[0]+'" aria-pressed="'+(c[0]===menuPortee)+'">'+c[1]+'</button>'}).join('')+'</div>';
    }
    if(etat.invite?ADM.hdInvite:ADM.hd!==false)h+='<button class="choix" role="menuitem" data-q="hd">'+I.hd+'<b>Haute définition<span>'+hd+'</span></b><small>Le fichier original, en pleine résolution. Pour les tirages, l’album photo et pour garder vos souvenirs en sécurité.</small></button>';
    if(!etat.invite||ADM.web!==false)h+='<button class="choix" role="menuitem" data-q="web">'+I.web+'<b>Taille web<span>'+web+'</span></b><small>Une version allégée (2048 px) qui reste nette à l’écran. Pour les réseaux sociaux, WhatsApp et les e-mails.</small></button>';
    m.innerHTML=h;
    m.querySelectorAll('[data-portee]').forEach(function(c){c.onclick=function(e){e.stopPropagation();menuPortee=c.dataset.portee;construire()}});
    m.querySelectorAll('[data-q]').forEach(function(c){c.onclick=function(){
      var web=c.dataset.q==='web';fermerMenu();
      var quoi=photo?'une photo':menuPortee==='tout'?'la galerie complète':menuPortee==='fav'?'ses favoris':menuPortee==='album'?'sa sélection album':'la catégorie « '+nomDossier(menuPortee)+' »';
      if(APERCU){toast('Aperçu : le téléchargement est désactivé.');return}
      var q=web?'web':'hd',a=document.createElement('a');
      a.href=photo?'/dl/'+SLUG+'/'+photo.id+'?q='+q:'/zip/'+SLUG+'?portee='+encodeURIComponent(menuPortee)+'&q='+q;
      a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
      toast(photo?'Téléchargement de '+photo.nom+' lancé.':'Préparation du fichier ZIP ('+n+' photo'+(n>1?'s':'')+', '+(web?web:hd)+') : le téléchargement démarre dans un instant.');
    }});
  }
  construire();
  m.hidden=false;btn.setAttribute('aria-expanded','true');
  var r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
  var left=Math.max(12,Math.min(r.right-mw,vw-mw-12)),top=r.bottom+6;
  if(top+mh>vh-12)top=Math.max(12,r.top-mh-6);
  m.style.left=left+'px';m.style.top=top+'px';
  var premier=m.querySelector('.choix');if(premier)premier.focus({preventScroll:true});
}
$('menu').addEventListener('click',function(e){e.stopPropagation()});
document.addEventListener('click',function(){if(!$('menu').hidden)fermerMenu()});
window.addEventListener('scroll',function(){if(!$('menu').hidden&&$('vision').hidden)fermerMenu()},{passive:true});

document.addEventListener('keydown',function(e){
  if(!$('menu').hidden&&e.key==='Escape'){fermerMenu();return}
  if(!$('voile-partage').hidden){if(e.key==='Escape')fermerPartage();return}
  if(!$('voile').hidden&&e.key==='Escape'){fermerFenetre();return}
  if($('vision').hidden)return;
  if(e.key==='Escape')fermerVision();if(e.key==='ArrowLeft')nav(-1);if(e.key==='ArrowRight')nav(1);
  if(e.key==='f'||e.key==='F')$('v-fav').click();
});
var tx=null,glisseAt=0;
document.querySelector('#vision .scene').addEventListener('click',function(e){if(e.target===this&&Date.now()-glisseAt>400)fermerVision()});
$('vision').addEventListener('touchstart',function(e){tx=e.touches[0].clientX},{passive:true});
$('vision').addEventListener('touchend',function(e){if(tx===null)return;var d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>50){nav(d<0?1:-1);glisseAt=Date.now()}tx=null});

/* ---------- Fenêtres ---------- */
function fenetre(html){$('fenetre').className='fenetre';$('fenetre').innerHTML=html;$('voile').hidden=false;$('fenetre').querySelectorAll('[data-ferme]').forEach(function(b){b.onclick=fermerFenetre});if(typeof suiviMaj==='function')suiviMaj()}
function fermerFenetre(){$('voile').hidden=true;if(typeof suiviMaj==='function')suiviMaj()}
$('voile').addEventListener('click',function(e){if(e.target===$('voile'))fermerFenetre()});

function fenetreListe(){
  fenetre('<h2>Nouvelle liste de favoris</h2><p>Par exemple « Tirages », « Pour maman » ou « Remerciements ».</p><div class="champ"><label for="nom-liste">Nom de la liste</label><input type="text" id="nom-liste" maxlength="30"></div><div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="ok-liste">Créer la liste</button></div>');
  $('nom-liste').focus();
  $('ok-liste').onclick=function(){var n=$('nom-liste').value.trim();if(!n)return;if(!etat.listes[n])etat.listes[n]=[];etat.listeActive=n;fermerFenetre();rendre();if(!APERCU)api('liste',{method:'POST',body:{nom:n}}).catch(function(e){toast(e.message)})};
}

$('btn-dl').onclick=function(e){e.stopPropagation();ouvrirMenu($('btn-dl'),null)};

/* ---------- Vue photographe ---------- */
var STATUTS={
  publiee:{nom:'Publiée',desc:'Visible par vos clients avec leur code d’accès.'},
  cachee:{nom:'Cachée',desc:'Invisible pour les clients. Vous seule y avez accès.'},
  archivee:{nom:'Archivée',desc:'Galerie fermée, fichiers conservés. Les clients voient un message d’expiration.'}
};
var CLASSEURS=['Mariages','Couple','Famille','Maternité','Événements'];
var admPage='collections';
var LOGO_SVG='{{LOGO_JS}}';
var admOnglet='photos',admSet=null,SELADM=new Set(),selAdmCtx='';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function dossierPar(id){for(var i=0;i<DOSSIERS.length;i++)if(DOSSIERS[i].id===id)return DOSSIERS[i]}
function lienGalerie(){return urlGalerie()}
function copier(txt,msg){
  function ok(){toast(msg||'Copié dans le presse-papiers.')}
  try{navigator.clipboard.writeText(txt).then(ok,function(){toast(txt)})}catch(e){toast(txt)}
}
function emails(){return ((DONNEES&&DONNEES.emails)||[]).map(function(m){return {d:dateHeure(m.ts),a:m.destinataire,o:m.objet,e:m.statut}})}
var PREFS={};
function sauverPrefs(b){Object.assign(PREFS,b);return api('prefs',{method:'PUT',body:b}).catch(function(e){toast(e.message)})}

/* Petit menu flottant réutilisable */
function fermerPop(){$('pop').hidden=true;$('pop')._btn=null}
function pop(btn,html,lier){
  var m=$('pop');
  if(!m.hidden&&m._btn===btn){fermerPop();return}
  fermerMenu();m.innerHTML=html;m.hidden=false;m._btn=btn;
  var r=btn.getBoundingClientRect(),mw=m.offsetWidth,mh=m.offsetHeight,vw=window.innerWidth,vh=window.innerHeight;
  var left=Math.max(12,Math.min(r.left,vw-mw-12)),top=r.bottom+6;
  if(top+mh>vh-12)top=Math.max(12,r.top-mh-6);
  m.style.left=left+'px';m.style.top=top+'px';
  if(lier)lier(m);
}
$('pop').addEventListener('click',function(e){e.stopPropagation()});
document.addEventListener('click',function(){if(!$('pop').hidden)fermerPop()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('pop').hidden)fermerPop()});
function itemPop(a,ico,txt,coche,sous){return '<button class="pop-item" data-a="'+a+'">'+(ico||'')+'<span>'+txt+(sous?'<small>'+sous+'</small>':'')+'</span>'+(coche?I.check:'')+'</button>'}

function couvAdm(){return ADM.couv&&parId(ADM.couv)?ADM.couv:(PHOTOS[0]&&PHOTOS[0].n)}
function rendreAdmin(){
  recalc();ADM.replie=!!PREFS.replie;
  if(!dossierPar(admSet))admSet=DOSSIERS[0]?DOSSIERS[0].id:null;
  var st=STATUTS[ADM.statut];
  $('admin').innerHTML=
   '<header class="adm-top">'+
     '<div class="adm-titre">'+
       '<button class="ibtn" id="adm-retour" title="Toutes mes collections" aria-label="Toutes mes collections">'+I.g+'</button>'+
       '<div class="adm-nom"><h1><button class="nom-modif" id="adm-renommer" title="Modifier le nom de la collection" aria-label="Modifier le nom de la collection"><span>'+esc(ADM.nom||NOMDEF)+'</span>'+I.crayon+'</button></h1><p>'+(ADM.dateEvt?dateFr(ADM.dateEvt):'')+' · '+I.dossier+'<span>'+esc(ADM.classeur||'Sans dossier')+'</span></p></div>'+
       '<button class="statut s-'+ADM.statut+'" id="adm-statut" aria-haspopup="menu">'+st.nom+I.caret+'</button>'+
     '</div>'+
     '<div class="adm-actions">'+
       '<button class="lienbtn" id="adm-plus" aria-haspopup="menu">Plus'+I.caret+'</button>'+
       '<a class="lienbtn" id="adm-apercu" href="/'+esc(ADM.slug)+'?apercu=1" target="_blank" rel="noopener">Prévisualiser</a>'+
       '<div class="split"><button class="btn sauge" id="adm-partager">Partager</button><button class="btn sauge" id="adm-partager-plus" aria-label="Autres options de partage" aria-haspopup="menu">'+I.caret+'</button></div>'+
     '</div>'+
   '</header>'+
   '<div class="adm-corps'+(ADM.replie?' replie':'')+'">'+
     '<aside class="adm-side">'+
       '<button class="adm-couv" id="adm-couv" style="'+(couvAdm()?'background-image:'+(urlCouvHd(couvAdm())?'url('+urlCouvHd(couvAdm())+'),':'')+'url('+SRC(couvAdm())+');':'')+'background-position:'+ADM.couvPos+(urlCouvHd(couvAdm())?','+ADM.couvPos:'')+'" aria-label="Changer la photo de couverture"><span>'+I.crayon+'Changer la couverture</span></button>'+
       '<div class="adm-tabs" role="tablist">'+[['photos',I.image,'Photos'],['activite',I.activite,'Activité'],['reglages',I.reglages,'Réglages']].map(function(o){return '<button class="adm-tab" role="tab" data-o="'+o[0]+'" aria-selected="'+(admOnglet===o[0])+'" title="'+o[2]+'" aria-label="'+o[2]+'">'+o[1]+'</button>'}).join('')+'</div>'+
       '<div id="adm-side"></div>'+
       '<button class="ibtn replier" id="adm-replier" title="'+(ADM.replie?'Déplier le panneau':'Replier le panneau')+'" aria-label="'+(ADM.replie?'Déplier le panneau':'Replier le panneau')+'">'+(ADM.replie?I.deplier:I.replier)+'</button>'+
     '</aside>'+
     '<main class="adm-main" id="adm-main"></main>'+
   '</div>';
  $('admin').querySelectorAll('.adm-tab').forEach(function(b){b.onclick=function(e){
    e.stopPropagation();
    if(ADM.replie&&admOnglet===b.dataset.o&&b.dataset.o==='photos'){volet(b);return}
    admOnglet=b.dataset.o;if(admOnglet==='activite'){recharger();return}rendreAdmin();
    if(ADM.replie&&admOnglet==='photos')volet(document.querySelector('.adm-tab[data-o=photos]'));
  }});
  $('adm-replier').onclick=function(){ADM.replie=!ADM.replie;sauverPrefs({replie:ADM.replie});fermerPop();rendreAdmin()};
  $('adm-couv').onclick=fenetreCouv;
  if($('adm-renommer'))$('adm-renommer').onclick=fenetreRenommer;
  $('adm-retour').onclick=function(){retourCollections()};
  $('adm-statut').onclick=function(e){e.stopPropagation();menuStatut(this)};
  $('adm-plus').onclick=function(e){e.stopPropagation();menuPlus(this)};
  $('adm-partager').onclick=function(){fenetrePartageAdm()};
  $('adm-partager-plus').onclick=function(e){e.stopPropagation();menuPartage(this)};
  if(admOnglet==='photos'){rendreSets();rendreSetMain()}
  else if(admOnglet==='activite'){rendreActivite()}
  else rendreReglages();
}

/* ---- Photo de couverture ---- */
function fenetreCouv(o){
  // o (facultatif) : { liste, titre, texte, libelle, valider(choix,pos,bouton) } — utilisé à la livraison d'une séance
  o=o||{};
  var liste=o.liste||PHOTOS,src=o.liste?function(n,v){return '/admin/api/img/'+CID+'/'+n+'/'+(v||'web')}:SRC;
  var choix=ADM.couv,pos=ADM.couvPos||'50% 50%',filtre='tout';
  function xy(){var m=pos.match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);return m?[+m[1],+m[2]]:[50,50]}
  fenetre(enteteFen(o.titre||'Photo de couverture')+
    '<p>'+(o.texte||'Choisissez la photo affichée en grand à l’ouverture de la galerie, puis touchez l’aperçu pour placer le point de cadrage.')+'</p>'+
    '<div class="couv-apercu" id="couv-apercu"><i class="point" id="couv-point"></i><span class="legende-couv">Point de cadrage</span></div>'+
    '<div class="portee" id="couv-filtres" style="padding:0;border:0;margin:0"></div>'+
    '<div class="couv-choix" id="couv-choix"></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="couv-ok">'+(o.libelle||'Enregistrer')+'</button></div>');
  $('fenetre').classList.add('couv-fen');
  if(!liste.length){toast('Ajoutez d’abord des photos à la collection.');fermerFenetre();return}
  if(!choix||!liste.some(function(p){return p.n===choix})){choix=liste[0].n;var p0=parId(choix);pos=p0&&p0.h>p0.w?'50% 35%':'50% 50%'}
  function majApercu(){var a=$('couv-apercu'),p=xy();a.style.backgroundImage='url('+src(choix)+')';a.style.backgroundPosition=pos;$('couv-point').style.left=p[0]+'%';$('couv-point').style.top=p[1]+'%'}
  function grille(){
    var doss=DOSSIERS.filter(function(d){return liste.some(function(p){return p.dossier===d.id})});
    $('couv-filtres').innerHTML=doss.length>1?[['tout','Toutes']].concat(doss.map(function(d){return [d.id,d.nom]})).map(function(c){return '<button class="chip" data-f="'+c[0]+'" aria-pressed="'+(c[0]===filtre)+'">'+esc(c[1])+'</button>'}).join(''):'';
    $('couv-filtres').querySelectorAll('[data-f]').forEach(function(b){b.onclick=function(){filtre=b.dataset.f;grille()}});
    var l=filtre==='tout'?liste:liste.filter(function(p){return p.dossier===filtre});
    $('couv-choix').innerHTML=l.map(function(p){return '<button data-n="'+p.n+'" aria-pressed="'+(p.n===choix)+'" title="'+esc(p.nom)+'"><img loading="lazy" src="'+src(p.n,'mini')+'" alt=""></button>'}).join('');
    $('couv-choix').querySelectorAll('[data-n]').forEach(function(b){b.onclick=function(){
      choix=+b.dataset.n;var ph=parId(choix);pos=ph&&ph.h>ph.w?'50% 35%':'50% 50%';
      $('couv-choix').querySelectorAll('[aria-pressed="true"]').forEach(function(x){x.setAttribute('aria-pressed','false')});b.setAttribute('aria-pressed','true');majApercu();
    }});
  }
  $('couv-apercu').onclick=function(e){var r=this.getBoundingClientRect();pos=Math.round((e.clientX-r.left)/r.width*100)+'% '+Math.round((e.clientY-r.top)/r.height*100)+'%';majApercu()};
  majApercu();grille();
  $('couv-ok').onclick=o.valider?function(){o.valider(choix,pos,this)}:function(){ADM.couv=choix;ADM.couvPos=pos;sauverAdm(true).then(function(){genererMur()});fermerFenetre();rendreAdmin();toast('Couverture mise à jour.')};
}

/* Panneau replié : les catégories s'ouvrent dans un volet flottant */
function volet(btn){
  pop(btn,'<div class="pop-label">Catégories</div>'+DOSSIERS.map(function(d){return itemPop(d.id,null,esc(d.nom)+' <span class="num" style="color:var(--brun-doux)">('+d.n+')</span>',d.id===admSet)}).join('')+
    '<div class="pop-sep"></div>'+itemPop('__ajout',I.plusRond,'Ajouter une catégorie'),function(m){
    var r=btn.getBoundingClientRect();m.style.left=(r.right+8)+'px';m.style.top=r.top+'px';
    m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){fermerPop();if(b.dataset.a==='__ajout'){fenetreSet(null);return}admSet=b.dataset.a;rendreSetMain()}});
  });
}

/* ---------- Page « Collections » ---------- */
var COLL={q:'',statut:'tout',classeur:null,dateEv:'tout',exp:'tout',etoile:false,alerte:null,tri:'date',vue:'grille'};
var COLLS=[];
function chargerCollections(){return Promise.all([api('collections'),api('prefs')]).then(function(r){COLLS=r[0]||[];PREFS=r[1]||{}})}
function collections(){
  return COLLS.map(function(c){var g=c.reglages;return {id:c.id,slug:c.slug,nom:g.nom,classeur:g.classeur||'',date:g.dateEvt||new Date(c.cree).toISOString().slice(0,10),statut:g.statut,photos:c.photos,go:(c.octets||0)/1e9,exp:g.expiration,
    seance:c.type==='seance',phase:g.phase,album:(c.type!=='seance'&&g.albumActif===false)?null:c.verrou?'validee':c.nsel?'cours':'aucun',sauvegarde:!!g.sauvegarde,cree:new Date(c.cree).toISOString().slice(0,10),creeTs:c.cree,
    couv:g.couv,couvPos:g.couvPos||'50% 50%',nsel:c.nsel,quota:g.quota,code:g.code,derniereRelance:c.derniereRelance,relanceAuto:g.relanceAuto!==false,relanceJours:g.relanceJours||14,publieLe:g.publieLe||null,premiere:c.premiere||null}});
}
/* ---- Compteur de requêtes du jour (limite de l'offre gratuite Cloudflare) ---- */
var USAGE=null,usageT=0;
function chargerUsage(){
  if(Date.now()-usageT<120e3)return;usageT=Date.now();
  api('usage').then(function(u){USAGE=u;rendreCompteur()}).catch(function(){});
}
function rendreCompteur(){
  var el=$('compteur-req');if(!el||!USAGE||!USAGE.configure)return;
  var u=USAGE,heure=new Date(u.remise).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}).replace(':',' h ').replace(' h 00',' h');
  if(u.erreur){el.hidden=false;el.className='compteur-req';el.innerHTML='<span>Requêtes du jour</span><small>Compteur indisponible pour le moment</small>';return}
  var pct=Math.min(100,u.requetes/u.limite*100),niveau=pct>=85?'alerte':pct>=60?'attention':'';
  el.hidden=false;el.className='compteur-req '+niveau;
  el.title='Requêtes comptées par Cloudflare aujourd’hui (chaque photo affichée en compte une). Remise à zéro à '+heure+'.';
  el.innerHTML='<span class="cr-ligne"><span>Requêtes du jour</span><b class="num">'+u.requetes.toLocaleString('fr-FR')+' <small>/ '+u.limite.toLocaleString('fr-FR')+'</small></b></span>'+
    '<span class="cr-jauge"><i style="width:'+pct.toFixed(1)+'%"></i></span>'+
    '<small>'+(niveau==='alerte'?'Limite proche : passez à l’offre payante ou attendez '+heure:niveau==='attention'?'Plus de 60 % utilisés · remise à zéro à '+heure:'Remise à zéro à '+heure)+'</small>';
}
function retourCollections(){admPage='collections';CID=null;DONNEES=null;history.replaceState(null,'',location.pathname);chargerCollections().then(function(){rendreCollections();window.scrollTo(0,0)}).catch(function(e){toast(e.message)})}
function joursAvant(iso){return iso?Math.ceil((new Date(iso+'T12:00:00')-new Date())/864e5):null}
function alertesDe(c){
  var a=[],j=joursAvant(c.exp);
  if(c.statut==='publiee'&&j!==null&&j>=0&&j<=30)a.push('expire');
  if(c.statut==='publiee'&&!c.seance&&(c.album==='aucun'||c.album==='cours'))a.push('album');
  if(c.album==='validee'&&!c.seance)a.push('produire');
  if(c.seance&&c.album==='validee'&&c.phase!=='livraison')a.push('retouche');
  if(c.seance&&c.statut==='publiee'&&c.phase!=='livraison'&&c.album!=='validee')a.push('selclient');
  if(c.statut==='publiee'&&c.photos>0&&!c.sauvegarde&&(!c.seance||c.phase==='livraison'))a.push('sauvegarde');
  return a;
}
var ALERTES={
  produire:{titre:'Albums validés à mettre en page',ico:'check',cls:'ok',qui:'moi'},
  retouche:{titre:'Sélections de séance à retoucher',ico:'crayon',cls:'ok',qui:'moi'},
  expire:{titre:'Expirent dans les 30 jours',ico:'historique',cls:'alerte',qui:'moi'},
  album:{titre:'Albums en attente du couple',ico:'livre',cls:'cours',qui:'client'},
  selclient:{titre:'Sélections de séance en attente',ico:'image',cls:'cours',qui:'client'},
  sauvegarde:{titre:'Galeries pas encore sauvegardées',ico:'dl',cls:'alerte',qui:'client'}
};
function estEtoile(id){return !!(PREFS.etoiles&&PREFS.etoiles[id])}
function dateCourte(c){if(c.dateTxt)return c.dateTxt;return new Date(c.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
function filtrer(liste){
  var q=COLL.q.trim().toLowerCase(),an=new Date().getFullYear();
  return liste.filter(function(c){
    if(q&&c.nom.toLowerCase().indexOf(q)<0)return false;
    if(COLL.statut!=='tout'&&c.statut!==COLL.statut)return false;
    if(COLL.classeur&&c.classeur!==COLL.classeur)return false;
    if(COLL.etoile&&!estEtoile(c.id))return false;
    if(COLL.alerte&&alertesDe(c).indexOf(COLL.alerte)<0)return false;
    var y=+c.date.slice(0,4);
    if(COLL.dateEv==='annee'&&y!==an)return false;
    if(COLL.dateEv==='avant'&&y>=an)return false;
    var j=joursAvant(c.exp);
    if(COLL.exp==='30'&&!(j!==null&&j>=0&&j<=30))return false;
    if(COLL.exp==='90'&&!(j!==null&&j>=0&&j<=90))return false;
    if(COLL.exp==='expirees'&&!(c.statut==='archivee'||(j!==null&&j<0)))return false;
    return true;
  }).sort(function(a,b){
    if(COLL.tri==='nom')return a.nom.localeCompare(b.nom,'fr');
    if(COLL.tri==='exp'){var x=joursAvant(a.exp),y=joursAvant(b.exp);return (x===null?9e9:x)-(y===null?9e9:y)}
    if(COLL.tri==='cree')return b.cree.localeCompare(a.cree);
    return b.date.localeCompare(a.date);
  });
}
function vignette(c,taille){
  if(c.couv||c.premiere)return '<span class="vg" style="background-image:url(/admin/api/img/'+c.id+'/'+(c.couv||c.premiere)+'/mini);background-position:'+c.couvPos+'"></span>';
  var t=c.ton||['#EBE3D9','#B9A27F'],ini=c.nom.replace(/^(Mariage|Famille|Séance)\s+/,'').split(/\s*&\s*|\s+/).filter(Boolean).map(function(w){return w[0]}).slice(0,2).join('&');
  return '<span class="vg vg-ex" style="background:linear-gradient(140deg,'+t[0]+','+t[1]+')"><b>'+esc(ini)+'</b></span>';
}
function filtresActifs(){return COLL.q||COLL.statut!=='tout'||COLL.dateEv!=='tout'||COLL.exp!=='tout'||COLL.etoile||COLL.alerte}

function rendreCollections(){
  fermerPop();
  var toutes=collections(),liste=filtrer(toutes);
  var stock=toutes.reduce(function(s,c){return s+(c.go||0)},0);
  var compte={};Object.keys(ALERTES).forEach(function(k){compte[k]=toutes.filter(function(c){return alertesDe(c).indexOf(k)>-1})});
  var dossierVue=!filtresActifs()&&!COLL.classeur;
  $('admin').innerHTML=
  '<div class="app'+(PREFS.replieApp?' replie':'')+'">'+
    asideApp(COLL.etoile?'etoiles':'collections',stock)+
    '<main class="app-main">'+
      '<div class="coll-tete">'+
        '<div class="coll-titre">'+((COLL.classeur||filtresActifs())?'<button class="ibtn coll-retour" id="coll-retour" title="Retour à toutes les collections" aria-label="Retour à toutes les collections">'+I.retour+'</button>':'')+(COLL.classeur?'<button class="lienbtn fil-ariane" id="retour-racine">Collections</button><span class="sep-ariane">›</span><h1>'+esc(COLL.classeur)+'</h1>':'<h1>'+(COLL.etoile?'Favoris':'Collections')+'</h1>')+
          '<label class="recherche">'+I.loupe+'<input type="search" id="coll-q" placeholder="Rechercher" value="'+esc(COLL.q)+'"></label></div>'+
        '<div class="adm-actions"><button class="lienbtn" id="voir-presets">Voir les préréglages</button>'+
          '<div class="split"><button class="btn sauge" id="nouvelle">Nouvelle collection</button><button class="btn sauge" id="nouvelle-plus" aria-label="Créer à partir d’un préréglage" aria-haspopup="menu">'+I.caret+'</button></div></div>'+
      '</div>'+
      (nbNouvelles()&&!COLL.classeur&&!COLL.etoile?'<button class="bandeau-dem" data-nav="demandes">'+I.boite+'<span><b>'+nbNouvelles()+' nouvelle'+(nbNouvelles()>1?'s':'')+' demande'+(nbNouvelles()>1?'s':'')+'</b> de devis ou de séance à traiter</span><span class="lien-voir">Voir les demandes →</span></button>':'')+
      // Le suivi n'apparaît que sur la page Collections principale (pas dans un dossier ni dans Favoris)
      (COLL.classeur||COLL.etoile?'':[['moi','À faire de mon côté','Ce qui attend une action de votre part'],['client','En attente des clients','Ce que vos clients doivent encore faire']].map(function(g){return '<section class="suivi-groupe" aria-label="'+g[1]+'"><div class="suivi-tete"><h2>'+g[1]+'</h2><span>'+g[2]+'</span></div><div class="suivi">'+Object.keys(ALERTES).filter(function(k){return ALERTES[k].qui===g[0]}).map(function(k){
        var A=ALERTES[k],l=compte[k];
        return '<div class="suivi-carte s-'+A.cls+(COLL.alerte===k?' actif':'')+(l.length?'':' vide')+'" data-alerte="'+k+'" role="button" tabindex="0" aria-pressed="'+(COLL.alerte===k)+'">'+
          '<span class="suivi-ico">'+I[A.ico]+'</span><b class="num">'+l.length+'</b><span class="suivi-titre">'+A.titre+'</span>'+
          '<small>'+(l.length?l.map(function(c){return esc(c.nom.replace(/^(Mariage|Séance couple|Séance famille|Séance maternité|Séance)\s+/,''))}).join(', '):'Rien à signaler')+'</small>'+((k==='album'||k==='selclient')&&l.length?'<button class="suivi-relance" data-relance="'+k+'">'+I.mail+'Relancer'+(l.length>1?' les '+l.length:'')+'</button><span class="suivi-auto">'+txtAuto(l)+'</span>':'')+'</div>';
      }).join('')+'</div></section>'}).join(''))+
      '<div class="coll-filtres">'+
        '<div class="puces">'+
          chip('statut','Statut',COLL.statut!=='tout'?STATUTS[COLL.statut].nom:'')+
          (COLL.classeur?'':chip('classeur','Dossier',''))+
          chip('dateEv','Date de l’événement',{tout:'',annee:'Cette année',avant:'Années précédentes'}[COLL.dateEv])+
          chip('exp','Expiration',{tout:'','30':'Sous 30 jours','90':'Sous 90 jours',expirees:'Expirées'}[COLL.exp])+
          '<button class="puce-filtre'+(COLL.etoile?' on':'')+'" id="f-etoile" aria-pressed="'+COLL.etoile+'">'+I.etoile+'Favoris</button>'+
          (filtresActifs()?'<button class="txtbtn" id="f-reset">Effacer les filtres</button>':'')+
        '</div>'+
        '<div class="outils-adm"><button class="ibtn" id="coll-tri" title="Trier" aria-label="Trier" aria-haspopup="menu">'+I.tri+'</button><button class="ibtn" id="coll-vue" title="'+(COLL.vue==='grille'?'Afficher en liste':'Afficher en grille')+'" aria-label="Changer l’affichage">'+(COLL.vue==='grille'?I.liste:I.grille)+'</button></div>'+
      '</div>'+
      (dossierVue?'<h2 class="coll-sous">Dossiers</h2><div class="dossiers">'+CLASSEURS.map(function(nom){
        var cs=toutes.filter(function(c){return c.classeur===nom});
        var cases=cs.slice(0,4).map(function(c){return vignette(c)}).join('');for(var i=cs.length;i<4;i++)cases+='<span class="vg vg-vide"></span>';
        return '<button class="dossier" data-classeur="'+esc(nom)+'"><span class="mosaique">'+cases+'</span><span class="dossier-nom">'+I.dossier+esc(nom)+'</span><small>'+cs.length+' collection'+(cs.length>1?'s':'')+'</small></button>';
      }).join('')+'</div><h2 class="coll-sous">Toutes les collections</h2>':'')+
      (liste.length?(COLL.vue==='grille'?'<div class="cartes">'+liste.map(carte).join('')+'</div>':
        '<div class="tableau"><table class="coll-table"><thead><tr><th></th><th>Collection</th><th>Dossier</th><th>Date</th><th>Statut</th><th style="text-align:right">Photos</th><th>Expiration</th><th>À surveiller</th><th></th></tr></thead><tbody>'+liste.map(ligne).join('')+'</tbody></table></div>')
      :'<div class="vide"><h3>Aucune collection</h3><span>'+(filtresActifs()?'Aucune collection ne correspond à ces filtres.':'Ce dossier est vide pour l’instant.')+'</span></div>')+
    '</main>'+
  '</div>';
  lierCollections();rendreCompteur();chargerUsage();
}
function asideApp(actif,stock){
  if(stock===undefined)stock=collections().reduce(function(s,c){return s+(c.go||0)},0);
  return ''+
    '<aside class="app-side">'+
      '<div class="app-marque"><span class="logo-box">'+LOGO_SVG+'</span><span class="app-nom">Mes galeries</span></div>'+
      '<nav class="app-nav">'+
        navItem('collections',I.image,'Collections',actif==='collections')+
        navItem('demandes',I.boite,'Demandes',actif==='demandes',nbNouvelles())+
        navItem('etoiles',I.etoile,'Favoris',actif==='etoiles')+
        navItem('accueil',I.ecran,'Page d’accueil',false)+
        navItem('reglages',I.reglages,'Réglages',false)+
      '</nav>'+
      '<nav class="app-nav app-sortie"><a class="app-lien" href="/cdn-cgi/access/logout" title="Se déconnecter">'+I.sortie+'<span>Se déconnecter</span></a></nav>'+
      '<div class="compteur-req" id="compteur-req" hidden></div>'+
      '<div class="app-bas">'+
        '<button class="ibtn" id="app-replier" title="'+(PREFS.replieApp?'Déplier':'Replier')+' le menu" aria-label="'+(PREFS.replieApp?'Déplier':'Replier')+' le menu">'+(PREFS.replieApp?I.deplier:I.replier)+'</button>'+
        '<div class="stockage" title="Stockage Cloudflare R2"><i class="anneau"></i><span><b class="num">'+stock.toFixed(1).replace('.',',')+' Go</b> utilisés<small>Sans limite · '+(stock<=10?'inclus dans l’offre gratuite':'≈ '+((stock-10)*0.015).toFixed(2).replace('.',',')+' $/mois')+'</small></span></div>'+
      '</div>'+
    '</aside>';
}
function navItem(id,ico,txt,actif,nb){return '<button class="app-lien'+(actif?' actif':'')+'" data-nav="'+id+'" title="'+txt+'">'+ico+'<span>'+txt+'</span>'+(nb?'<i class="nav-nb num">'+nb+'</i>':'')+'</button>'}
function chip(k,txt,val){return '<button class="puce-filtre'+(val?' on':'')+'" data-filtre="'+k+'" aria-haspopup="menu">'+txt+(val?' : <b>'+val+'</b>':'')+I.caret+'</button>'}
function badgesAlertes(c){
  var al=alertesDe(c);if(!al.length)return '';
  return '<span class="badges">'+al.map(function(k){return '<i class="badge-al s-'+ALERTES[k].cls+'" title="'+ALERTES[k].titre+'">'+I[ALERTES[k].ico]+'</i>'}).join('')+'</span>';
}
function texteExp(c){var j=joursAvant(c.exp);if(c.statut==='archivee'||(j!==null&&j<0))return 'Expirée';if(j===null)return 'Pas de date';return j<=30?'Expire dans '+j+' j':'Jusqu’au '+dateFr(c.exp)}
function carte(c){
  return '<article class="carte" data-id="'+c.id+'" tabindex="0" draggable="true" title="Glissez sur un dossier pour la ranger">'+
    '<div class="carte-img">'+vignette(c)+badgesAlertes(c)+
      '<div class="carte-outils"><button class="etoile'+(estEtoile(c.id)?' on':'')+'" data-etoile="'+c.id+'" aria-label="'+(estEtoile(c.id)?'Retirer des favoris':'Ajouter aux favoris')+'" title="'+(estEtoile(c.id)?'Retirer des favoris':'Ajouter aux favoris')+'">'+(estEtoile(c.id)?I.etoilePleine:I.etoile)+'</button>'+
      '<button class="kebab" data-actions="'+c.id+'" aria-label="Actions pour '+esc(c.nom)+'" title="Actions" aria-haspopup="menu">'+I.kebab+'</button></div></div>'+
    '<div class="carte-txt"><h3>'+esc(c.nom)+'</h3>'+
      '<p>'+dateCourte(c)+' · '+c.photos+' photo'+(c.photos>1?'s':'')+'</p>'+
      '<p class="carte-bas"><span class="statut mini s-'+c.statut+'">'+STATUTS[c.statut].nom+'</span><span>'+texteExp(c)+'</span></p></div>'+
  '</article>';
}
function ligne(c){
  return '<tr data-id="'+c.id+'" tabindex="0" draggable="true"><td class="td-vg">'+vignette(c)+'</td><td><b>'+esc(c.nom)+'</b></td><td>'+(c.classeur?esc(c.classeur):'<span class="note">—</span>')+'</td><td>'+dateCourte(c)+'</td><td><span class="statut mini s-'+c.statut+'">'+STATUTS[c.statut].nom+'</span></td><td class="n">'+c.photos+'</td><td>'+texteExp(c)+'</td><td>'+(badgesAlertes(c)||'—')+'</td>'+
    '<td class="td-act"><button class="etoile plate'+(estEtoile(c.id)?' on':'')+'" data-etoile="'+c.id+'" aria-label="Ajouter aux favoris">'+(estEtoile(c.id)?I.etoilePleine:I.etoile)+'</button><button class="kebab plate" data-actions="'+c.id+'" aria-label="Actions" aria-haspopup="menu">'+I.kebab+'</button></td></tr>';
}
function deplacerCollection(id,classeur){
  var c=collections().filter(function(x){return x.id===id})[0];if(!c||c.classeur===classeur)return false;
  changerClasseur(c,classeur);toast(classeur?'« '+c.nom+' » rangée dans '+classeur+'.':'« '+c.nom+' » n’est plus dans un dossier.');return true;
}
/* Menu ⋮ d'une collection */
function menuCollection(btn,id){
  var c=collections().filter(function(x){return x.id===id})[0];if(!c)return;
  var apercu='<a class="pop-item" href="/'+esc(c.slug)+'?apercu=1" target="_blank" rel="noopener" data-a="apercu">'+I.oeil+'<span>Prévisualiser</span></a>';
  var dr=derniereRelance(c);
  var h=itemPop('partager',I.envoyer,'Partager')+(aRelancer(c)?itemPop('relancer',I.mail,'Relancer le client',false,dr?'Dernière relance '+depuis(dr):'Jamais relancé'):'')+apercu+itemPop('rapide',I.crayon,'Modification rapide')+itemPop('deplacer',I.deplacer,'Déplacer vers')+itemPop('dupliquer',I.dupliquer,'Dupliquer')+'<div class="pop-sep"></div>'+(COLL.classeur?itemPop('retirer',I.sortir,'Retirer du dossier',false,'Reste dans Toutes les collections'):itemPop('supprimer',I.corbeille,'Supprimer'));
  pop(btn,h,function(m){
    var r=btn.getBoundingClientRect(),mw=m.offsetWidth;m.style.left=Math.max(12,Math.min(r.right-mw,window.innerWidth-mw-12))+'px';
    m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
      var act=b.dataset.a;fermerPop();
      if(act==='apercu')return;
      ({partager:partagerCollection,rapide:editionRapide,deplacer:deplacerVers,dupliquer:dupliquerCollection,supprimer:supprimerCollection,retirer:retirerDuDossier,relancer:function(c){fenetreRelance([c])}})[act](c);
    }});
  });
}
function slugDe(c){return c.slug}
function majCollLocale(id,g){COLLS.forEach(function(x){if(x.id===id)Object.assign(x.reglages,g)})}
function changerClasseur(c,classeur){
  majCollLocale(c.id,{classeur:classeur});
  return api('collections/'+c.id,{method:'PATCH',body:{classeur:classeur}}).catch(function(e){toast(e.message);retourCollections()});
}
function retirerDuDossier(c){
  var d=c.classeur;changerClasseur(c,'');rendreCollections();
  toast('« '+c.nom+' » retirée du dossier '+d+'. Elle reste dans Toutes les collections.');
}
function partagerCollection(c){ouvrirCollection(c.id).then(function(ok){if(ok)fenetrePartageAdm()})}
// Renommer la collection depuis la vue photographe (l'adresse de la galerie ne change pas)
function fenetreRenommer(){
  fenetre(enteteFen('Nom de la collection')+
    '<div class="champ"><label for="rn-nom">Nom</label><input type="text" id="rn-nom" maxlength="120" value="'+esc(ADM.nom||'')+'"><p class="note">Affiché sur la couverture, dans les e-mails et dans l’aperçu des liens. L’adresse de la galerie reste la même : un lien déjà envoyé continue de fonctionner.</p></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="rn-ok">Enregistrer</button></div>');
  var ch=$('rn-nom');ch.focus();ch.select();
  ch.onkeydown=function(e){if(e.key==='Enter')$('rn-ok').click()};
  $('rn-ok').onclick=function(){
    var nom=ch.value.trim();if(!nom){toast('Le nom ne peut pas être vide.');return}
    if(nom===ADM.nom){fermerFenetre();return}
    var avant=ADM.nom;ADM.nom=nom;this.disabled=true;
    var btn=this;
    sauverAdm(true).then(function(r){
      if(!r){ADM.nom=avant;btn.disabled=false;return}
      try{majCollLocale(CID,{nom:nom})}catch(_){}
      fermerFenetre();rendreAdmin();if(typeof majNoms==='function')majNoms();
      genererBanniere();toast('Collection renommée.');
    });
  };
}
function editionRapide(c){
  fenetre(enteteFen('Modification rapide')+
    '<div class="champ"><label for="er-nom">Nom</label><input type="text" id="er-nom" value="'+esc(c.nom)+'"></div>'+
    '<div class="champ"><label for="er-date">Date de l’événement</label><input type="date" id="er-date" value="'+c.date+'"></div>'+
    '<div class="champ"><label for="er-dossier">Dossier</label><select id="er-dossier"><option value=""'+(c.classeur?'':' selected')+'>Aucun dossier</option>'+CLASSEURS.map(function(x){return '<option'+(x===c.classeur?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select></div>'+
    '<div class="champ"><label for="er-statut">Statut</label><select id="er-statut">'+Object.keys(STATUTS).map(function(k){return '<option value="'+k+'"'+(k===c.statut?' selected':'')+'>'+STATUTS[k].nom+'</option>'}).join('')+'</select></div>'+
    '<div class="champ"><label for="er-exp">Expiration</label><input type="date" id="er-exp" value="'+(c.exp||'')+'"></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="er-ok">Enregistrer</button></div>');
  $('er-ok').onclick=function(){
    var nom=$('er-nom').value.trim();if(!nom){toast('Le nom ne peut pas être vide.');return}
    var v={nom:nom,classeur:$('er-dossier').value,statut:$('er-statut').value,dateEvt:$('er-date').value||c.date};
    if($('er-exp').value)v.expiration=$('er-exp').value;
    api('collections/'+c.id,{method:'PATCH',body:v}).then(function(){majCollLocale(c.id,v);fermerFenetre();rendreCollections();toast('Collection mise à jour.')}).catch(function(e){toast(e.message)});
  };
}
function deplacerVers(c){
  fenetre(enteteFen('Déplacer vers')+'<p>Choisissez le dossier de « '+esc(c.nom)+' ».</p><div class="options">'+
    CLASSEURS.map(function(x){return '<label class="option"><span class="g"><input type="radio" name="dv" value="'+esc(x)+'"'+(x===c.classeur?' checked':'')+'><span>'+esc(x)+'</span></span></label>'}).join('')+'<label class="option"><span class="g"><input type="radio" name="dv" value=""'+(c.classeur?'':' checked')+'><span>Aucun dossier</span></span></label>'+
    '</div><div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="dv-ok">Déplacer</button></div>');
  $('dv-ok').onclick=function(){var x=document.querySelector('[name=dv]:checked').value;fermerFenetre();if(deplacerCollection(c.id,x))rendreCollections()};
}
function dupliquerCollection(c){
  fenetre(enteteFen('Dupliquer la collection')+'<p>Une copie de « '+esc(c.nom)+' » est créée avec les mêmes catégories et réglages, en statut cachée, sans les photos. Les favoris, la sélection et les statistiques ne sont pas copiés.</p><div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="dc-ok">Dupliquer</button></div>');
  $('dc-ok').onclick=function(){
    this.disabled=true;
    api('collections/'+c.id+'/dupliquer',{method:'POST',body:{}}).then(function(){fermerFenetre();return chargerCollections()}).then(function(){if(admPage==='collections')rendreCollections();toast('Copie créée, en statut cachée.')}).catch(function(e){toast(e.message)});
  };
}
function supprimerCollection(c,apres){
  fenetre('<h2>Supprimer « '+esc(c.nom)+' » ?</h2><p>La galerie et ses '+c.photos+' photos en ligne seront supprimées définitivement. Vos clients ne pourront plus y accéder. Vos fichiers sur votre ordinateur ne sont pas touchés.</p>'+
    '<label class="option"><span class="g"><input type="checkbox" id="sc-case"><span>Je comprends que cette action est définitive</span></span></label>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn danger" id="sc-ok" disabled>Supprimer</button></div>');
  $('sc-case').onchange=function(){$('sc-ok').disabled=!this.checked};
  $('sc-ok').onclick=function(){
    this.disabled=true;this.textContent='Suppression…';
    api('collections/'+c.id,{method:'DELETE'}).then(function(){fermerFenetre();toast('« '+c.nom+' » supprimée.');if(apres)apres();else{COLLS=COLLS.filter(function(x){return x.id!==c.id});rendreCollections()}}).catch(function(e){toast(e.message)});
  };
}
function ouvrirCollection(id){
  return api('collections/'+id).then(function(d){
    DONNEES=d;CID=d.id;SEANCE=d.type==='seance';majTxt();iconesMode();
    ADM=Object.assign({},d.reglages,{slug:d.slug});
    DOSSIERS=ADM.dossiers;QUOTA=ADM.quota;
    if(EVT()&&ADM.codeInvite!==ADM.code){ADM.codeInvite=ADM.code;sauverAdm(true)}
    VARS={};TOUTES=d.photos.map(function(p){VARS[p.id]=p.variantes;return {id:p.id,n:p.id,nom:p.nom,dossier:p.dossier,w:p.w||3,h:p.h||2,ordre:p.ordre,mo:p.variantes.hd?p.variantes.hd.o/1e6:0,variantes:p.variantes}});
    recalc();
    etat.album=d.etat.album||[];etat.verrou=!!d.etat.verrou;etat.notes=d.etat.notes||{};
    ADM.albumDebut=d.etat.debut;ADM.albumMaj=d.etat.maj;ADM.albumValide=d.etat.valide;
    etat.listes={'Favoris':[]};etat.listeActive='Favoris';
    d.favoris.forEach(function(f){if(etat.listes.Favoris.indexOf(f.photo_id)<0)etat.listes.Favoris.push(f.photo_id)});
    ADM.journal=d.journal.map(function(j){return {t:j.ts,q:j.qui,a:j.quoi}}).reverse();
    admPage='collection';
    setTimeout(function(){if(CID!==d.id)return;if(!couvAJour())genererCouv();if(!partageAJour())genererPartage();
      // E-mails revenus au beige (10 octobre 2026) : les bannières faites entre-temps ont des coins blancs, on les refait
      var PALETTE=Date.UTC(2026,9,11,2,20);if(PHOTOS.length&&((ADM.banniere&&ADM.banniere<PALETTE)||(SELP()&&ADM.banniereFlou&&ADM.banniereFlou<PALETTE)))genererBanniere();
    },1500);
    if(location.hash!=='#c='+id)history.replaceState(null,'','#c='+id);
    rendreAdmin();
    // Ouvrir une collection ramène toujours en haut de la page (on arrivait au milieu si la liste était défilée)
    window.scrollTo(0,0);document.documentElement.scrollTop=0;document.body.scrollTop=0;
    return true;
  }).catch(function(e){toast(e.message);return false});
}
function recharger(){return CID?ouvrirCollection(CID):Promise.resolve()}
function collCourante(){return collections().filter(function(c){return c.id===CID})[0]||{id:CID,slug:ADM.slug,nom:ADM.nom,nsel:etat.album.length,quota:QUOTA,code:ADM.code,seance:SEANCE,phase:ADM.phase,statut:ADM.statut,classeur:ADM.classeur,album:etat.verrou?'validee':etat.album.length?'cours':'aucun',exp:ADM.expiration,photos:PHOTOS.length,relanceAuto:ADM.relanceAuto!==false,relanceJours:ADM.relanceJours||14,derniereRelance:DONNEES&&DONNEES.relances&&DONNEES.relances[0]?DONNEES.relances[0].ts:null,publieLe:ADM.publieLe,creeTs:DONNEES?DONNEES.cree:Date.now(),date:ADM.dateEvt}}
function vueGlobale(){COLL.q='';COLL.statut='tout';COLL.dateEv='tout';COLL.exp='tout';COLL.etoile=false;COLL.alerte=null;COLL.classeur=null;admPage='collections';rendreCollections();window.scrollTo(0,0)}
function lierNav(rendreIci){
  $('admin').querySelectorAll('[data-nav]').forEach(function(b){b.onclick=function(){
    var n=b.dataset.nav;
    if(n==='collections'){vueGlobale()}
    else if(n==='demandes'){ouvrirDemandes()}
    else if(n==='etoiles'){COLL.etoile=true;COLL.classeur=null;admPage='collections';rendreCollections()}
    else if(n==='accueil')toast('La page d’accueil publique de vos galeries sera construite avec votre site melissa-simeon.com.');
    else toast('Réglages généraux (logo, modèles d’e-mails, domaine, préréglages) : prévus pour la version en ligne.');
  }});
  $('app-replier').onclick=function(){sauverPrefs({replieApp:!PREFS.replieApp});rendreIci()};
}
function lierCollections(){
  var a=$('admin');
  lierNav(rendreCollections);
  var r=$('retour-racine');if(r)r.onclick=vueGlobale;var cr=$('coll-retour');if(cr)cr.onclick=vueGlobale;
  var q=$('coll-q');q.oninput=function(){COLL.q=q.value;var pos=q.selectionStart;rendreCollections();var n=$('coll-q');n.focus();n.setSelectionRange(pos,pos)};
  $('voir-presets').onclick=fenetrePresets;
  $('nouvelle').onclick=function(){fenetreNouvelle(null)};
  $('nouvelle-plus').onclick=function(e){e.stopPropagation();
    pop(this,'<div class="pop-label">Créer à partir d’un préréglage</div>'+itemPop('Mariage',I.livre,'Mariage',false,PRESETS['Mariage'].sous)+itemPop('Séance photo',I.coeur,'Séance photo',false,PRESETS['Séance photo'].sous)+itemPop('Événement',I.image,'Événement',false,PRESETS['Événement'].sous),function(m){
      m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){fermerPop();fenetreNouvelle(b.dataset.a)}})});
  };
  a.querySelectorAll('[data-alerte]').forEach(function(b){b.onclick=function(){COLL.alerte=COLL.alerte===b.dataset.alerte?null:b.dataset.alerte;COLL.classeur=null;rendreCollections()};b.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}}});
  a.querySelectorAll('[data-relance]').forEach(function(b){b.onclick=function(e){e.stopPropagation();var k=b.dataset.relance;fenetreRelance(collections().filter(function(c){return alertesDe(c).indexOf(k)>-1}))}});
  a.querySelectorAll('[data-filtre]').forEach(function(b){b.onclick=function(e){e.stopPropagation();menuFiltre(b,b.dataset.filtre)}});
  $('f-etoile').onclick=function(){COLL.etoile=!COLL.etoile;rendreCollections()};
  var fr=$('f-reset');if(fr)fr.onclick=function(){COLL.q='';COLL.statut='tout';COLL.dateEv='tout';COLL.exp='tout';COLL.etoile=false;COLL.alerte=null;rendreCollections()};
  $('coll-vue').onclick=function(){COLL.vue=COLL.vue==='grille'?'liste':'grille';rendreCollections()};
  $('coll-tri').onclick=function(e){e.stopPropagation();
    pop(this,'<div class="pop-label">Trier par</div>'+[['date','Date de l’événement (récent d’abord)'],['cree','Date de création'],['exp','Expiration la plus proche'],['nom','Nom (A → Z)']].map(function(o){return itemPop(o[0],null,o[1],COLL.tri===o[0])}).join(''),function(m){
      m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){COLL.tri=b.dataset.a;rendreCollections()}})});
  };
  a.querySelectorAll('[data-classeur]').forEach(function(b){
    b.onclick=function(){COLL.classeur=b.dataset.classeur;rendreCollections();window.scrollTo(0,0)};
    b.addEventListener('dragover',function(e){if(!glisseId)return;e.preventDefault();try{e.dataTransfer.dropEffect='move'}catch(_){}b.classList.add('cible')});
    b.addEventListener('dragleave',function(e){if(!b.contains(e.relatedTarget))b.classList.remove('cible')});
    b.addEventListener('drop',function(e){e.preventDefault();b.classList.remove('cible');var id=glisseId;glisseId=null;if(id&&deplacerCollection(id,b.dataset.classeur))rendreCollections()});
  });
  a.querySelectorAll('[data-etoile]').forEach(function(b){b.onclick=function(e){e.stopPropagation();var et=Object.assign({},PREFS.etoiles||{});et[b.dataset.etoile]=!et[b.dataset.etoile];sauverPrefs({etoiles:et});rendreCollections()}});
  a.querySelectorAll('[data-actions]').forEach(function(b){b.onclick=function(e){e.stopPropagation();menuCollection(b,b.dataset.actions)}});
  var glisseId=null;
  a.querySelectorAll('.carte[data-id],tr[data-id]').forEach(function(el){
    el.addEventListener('dragstart',function(e){glisseId=el.dataset.id;el.classList.add('glisse');a.querySelector('.app').classList.add('en-glisse');try{e.dataTransfer.setData('text/plain',glisseId);e.dataTransfer.effectAllowed='move'}catch(_){}});
    el.addEventListener('dragend',function(){el.classList.remove('glisse');var ap=a.querySelector('.app');if(ap)ap.classList.remove('en-glisse');a.querySelectorAll('.dossier.cible').forEach(function(d){d.classList.remove('cible')});glisseId=null});
    el.onclick=function(){ouvrirCollection(el.dataset.id)};
    el.onkeydown=function(e){if(e.key==='Enter')ouvrirCollection(el.dataset.id)};
  });
}
function menuFiltre(btn,k){
  var opts={
    statut:[['tout','Tous les statuts']].concat(Object.keys(STATUTS).map(function(s){return [s,STATUTS[s].nom]})),
    classeur:CLASSEURS.map(function(c){return [c,c]}),
    dateEv:[['tout','Toutes les dates'],['annee','Cette année'],['avant','Années précédentes']],
    exp:[['tout','Toutes'],['30','Expirent sous 30 jours'],['90','Expirent sous 90 jours'],['expirees','Expirées']]
  }[k];
  pop(btn,opts.map(function(o){return itemPop(o[0],null,o[1],k==='classeur'?COLL.classeur===o[0]:COLL[k]===o[0])}).join(''),function(m){
    m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){COLL[k]=b.dataset.a;rendreCollections()}});
  });
}
var PRESETS={'Mariage':{type:'mariage',classeur:'Mariages',sous:'6 mois · sélection de 60 photos si l’album est inclus'},'Séance photo':{type:'seance',classeur:'Couple',sous:'3 mois · sélection filigranée par le client'},'Événement':{type:'mariage',classeur:'Événements',albumActif:false,evenement:true,sous:'3 mois · sans album · un seul code d’accès pour tout le monde'}};
function fenetreNouvelle(preset,pre){
  preset=PRESETS[preset]?preset:'Mariage';
  fenetre(enteteFen('Nouvelle collection')+
    '<div class="champ"><label for="nc-nom">Nom de la collection</label><input type="text" id="nc-nom" placeholder="Par exemple : Mariage Léa & Thomas"></div>'+
    '<div class="champ"><label for="nc-preset">Type</label><select id="nc-preset">'+Object.keys(PRESETS).map(function(p){return '<option'+(p===preset?' selected':'')+'>'+p+'</option>'}).join('')+'</select><p class="note" id="nc-sous"></p></div>'+
    '<div class="champ" id="nc-seance-champ"><span class="etiquette-champ" id="nc-seance-lab">Type de séance</span><div class="options" role="radiogroup" aria-labelledby="nc-seance-lab" style="grid-template-columns:repeat(3,1fr)">'+
      [['couple','Couple'],['maternite','Maternité'],['famille','Famille']].map(function(t){return '<label class="option"><span class="g"><input type="radio" name="nc-seance" id="nc-seance-'+t[0]+'" value="'+t[0]+'"><span>'+t[1]+'</span></span></label>'}).join('')+'</div></div>'+
    '<div class="champ" id="nc-quota-champ"><label for="nc-quota">Photos retouchées incluses dans la formule</label><input type="number" id="nc-quota" min="1" max="500" value="15" inputmode="numeric"><p class="note">Le client choisit ce nombre de photos dans sa sélection. Au-delà, chaque photo supplémentaire est facturée (10 € par défaut, modifiable dans les réglages).</p></div>'+
    '<div class="champ"><span class="etiquette-champ" id="nc-code-lab">Accès à la galerie</span><div class="options" role="radiogroup" aria-labelledby="nc-code-lab" style="grid-template-columns:1fr 1fr">'+
      '<label class="option"><span class="g"><input type="radio" name="nc-code" id="nc-code-oui" value="oui" checked><span>Avec code</span></span></label>'+
      '<label class="option"><span class="g"><input type="radio" name="nc-code" id="nc-code-non" value="non"><span>Sans code</span></span></label></div>'+
      '<p class="note" id="nc-code-note"></p></div>'+
    '<div class="champ" id="nc-album-champ"><span class="etiquette-champ" id="nc-album-lab">Album photo inclus dans la prestation ?</span><div class="options" role="radiogroup" aria-labelledby="nc-album-lab" style="grid-template-columns:1fr 1fr">'+
      '<label class="option"><span class="g"><input type="radio" name="nc-album" id="nc-album-oui" value="oui"><span>Oui, avec album</span></span></label>'+
      '<label class="option"><span class="g"><input type="radio" name="nc-album" id="nc-album-non" value="non"><span>Non, sans album</span></span></label></div>'+
      '<p class="note">Avec album, le couple choisit ses photos dans la galerie et reçoit l’explication du livre photo. Sans album, pas de sélection ni de relance.</p></div>'+
    '<div class="champ"><label for="nc-date">Date de l’événement</label><input type="date" id="nc-date"></div>'+
    '<div class="champ"><label for="nc-dossier">Dossier</label><select id="nc-dossier">'+CLASSEURS.map(function(c){return '<option'+(c===PRESETS[preset].classeur?' selected':'')+'>'+esc(c)+'</option>'}).join('')+'<option value="">Aucun dossier</option></select></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="nc-ok">Créer la collection</button></div>');
  function maj(){var P=PRESETS[$('nc-preset').value];$('nc-album-champ').hidden=!(P.type==='mariage'&&P.albumActif!==false);$('nc-seance-champ').hidden=$('nc-quota-champ').hidden=P.type!=='seance';$('nc-sous').textContent=P.sous+'. Vous pourrez tout modifier ensuite dans les réglages.';$('nc-dossier').value=P.classeur;$('nc-nom').placeholder=P.type==='seance'?'Par exemple : Séance famille Joseph':P.evenement?'Par exemple : Soirée de gala Kopa':'Par exemple : Mariage Léa & Thomas'}
  function majCode(){var sans=$('nc-code-non').checked,P=PRESETS[$('nc-preset').value];$('nc-code-note').textContent=sans?'Le lien suffit : seul l’e-mail du visiteur est demandé, et tout le monde a le même accès.':P.evenement?'Un code unique, le même pour tout le monde.':P.type==='seance'?'Un code d’accès est créé pour votre client.':'Un code pour le couple et un code pour les invités.'}
  document.querySelectorAll('[name=nc-code]').forEach(function(r){r.onchange=majCode});
  $('nc-preset').onchange=function(){maj();majCode()};maj();majCode();$('nc-nom').focus();
  var DOSSIER_SEANCE={couple:'Couple',maternite:'Maternité',famille:'Famille'},EX_SEANCE={couple:'Séance couple Cendrine & Thierry',maternite:'Séance maternité Laura',famille:'Famille Joseph'};
  document.querySelectorAll('[name=nc-seance]').forEach(function(r){r.onchange=function(){
    var sel=$('nc-dossier'),v=DOSSIER_SEANCE[r.value];
    if(![].some.call(sel.options,function(o){return o.value===v})){var o=document.createElement('option');o.textContent=v;sel.insertBefore(o,sel.lastElementChild)}
    sel.value=v;$('nc-nom').placeholder='Par exemple : '+EX_SEANCE[r.value];
  }});
  if(pre){
    if(pre.nom)$('nc-nom').value=pre.nom;if(pre.date)$('nc-date').value=pre.date;
    if(pre.album&&$('nc-album-'+pre.album))$('nc-album-'+pre.album).checked=true;
    $('fenetre').querySelector('.partage-tete').insertAdjacentHTML('afterend','<p class="note">Créée à partir de la demande : le nom, la date et l’e-mail du client sont repris. Vérifiez-les avant de valider.</p>');
  }
  $('nc-ok').onclick=function(){
    var nom=$('nc-nom').value.trim();if(!nom){toast('Donnez un nom à la collection.');$('nc-nom').focus();return}
    var P=PRESETS[$('nc-preset').value],d=$('nc-date').value||new Date().toISOString().slice(0,10),b=this;
    var albumActif=P.albumActif,sousType=null,quota=null,classeur=$('nc-dossier').value;
    if(P.type==='seance'){
      var st=document.querySelector('[name=nc-seance]:checked');if(!st){toast('Choisissez le type de séance : couple, maternité ou famille.');$('nc-seance-couple').focus();return}
      sousType=st.value;quota=parseInt($('nc-quota').value,10);if(!(quota>0)){toast('Indiquez le nombre de photos incluses.');$('nc-quota').focus();return}
    }
    if(!$('nc-album-champ').hidden){var ch=document.querySelector('[name=nc-album]:checked');if(!ch){toast('Indiquez si l’album photo est inclus.');$('nc-album-oui').focus();return}albumActif=ch.value==='oui'}
    var mois=P.type==='seance'||P.albumActif===false?3:6,e=new Date(d+'T12:00:00');e.setMonth(e.getMonth()+mois);
    if(e<new Date()){e=new Date();e.setMonth(e.getMonth()+mois)}
    b.disabled=true;
    api('collections',{method:'POST',body:{nom:nom,type:P.type,classeur:classeur,dateEvt:d,expiration:e.toISOString().slice(0,10),albumActif:albumActif,sousType:sousType,quota:quota,evenement:!!P.evenement,sansCode:$('nc-code-non').checked,contacts:pre&&pre.email?[pre.email]:[]}}).then(function(r){
      if(pre&&pre.demande)api('demandes/'+pre.demande,{method:'PATCH',body:{collectionId:r.id,statut:'reservee'}}).then(majDemandeLocale).catch(function(){});
      fermerFenetre();toast('Collection créée, en statut cachée. Ajoutez-y vos photos.');return ouvrirCollection(r.id);
    }).catch(function(err){b.disabled=false;toast(err.message)});
  };
}

/* ---- Statut ---- */
function menuStatut(btn){
  var h='<div class="pop-label">Statut de la collection</div>'+Object.keys(STATUTS).map(function(k){return itemPop(k,'<i class="pastille s-'+k+'"></i>',STATUTS[k].nom,ADM.statut===k,STATUTS[k].desc)}).join('');
  pop(btn,h,function(m){m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    ADM.statut=b.dataset.a;sauverAdm(true).then(function(){if(ADM.statut==='publiee')genererMur()});fermerPop();rendreAdmin();
    toast(ADM.statut==='publiee'?'Collection publiée : vos clients y ont accès.':ADM.statut==='cachee'?'Collection cachée : vos clients ne peuvent plus l’ouvrir.':'Collection archivée : les clients voient un message d’expiration.');
  }})});
}

/* ---- Catégories ---- */
function rendreSets(){
  $('adm-side').innerHTML='<div class="sets-tete"><span class="etiquette">Catégories</span><button class="txtbtn" id="set-ajout">'+I.plusRond+'Ajouter</button></div>'+
    '<ul class="sets" id="sets">'+DOSSIERS.map(function(d){
      return '<li class="set" draggable="true" data-id="'+d.id+'" aria-current="'+(d.id===admSet)+'" tabindex="0">'+
        '<span class="poignee" title="Glisser pour changer l’ordre">'+I.poignee+'</span>'+
        '<span class="set-nom">'+esc(d.nom)+' <span class="num">('+d.n+')</span></span>'+
        '<button class="ibtn petit plus-set" data-id="'+d.id+'" aria-label="Options de la catégorie '+esc(d.nom)+'" aria-haspopup="menu">'+I.points+'</button></li>';
    }).join('')+'</ul>'+
    '<p class="note side-note">Glissez les catégories pour changer leur ordre dans la galerie de vos clients.</p>';
  $('set-ajout').onclick=function(){fenetreSet(null)};
  var liste=$('sets'),glisse=null;
  liste.querySelectorAll('.set').forEach(function(li){
    li.onclick=function(e){if(e.target.closest('.plus-set'))return;admSet=li.dataset.id;rendreSets();rendreSetMain()};
    li.onkeydown=function(e){if(e.key==='Enter')li.click()};
    li.querySelector('.plus-set').onclick=function(e){e.stopPropagation();menuSet(this,li.dataset.id)};
    li.addEventListener('dragstart',function(e){glisse=li.dataset.id;li.classList.add('glisse');try{e.dataTransfer.setData('text/plain',glisse);e.dataTransfer.effectAllowed='move'}catch(_){}});
    li.addEventListener('dragend',function(){li.classList.remove('glisse');liste.querySelectorAll('.set').forEach(function(x){x.classList.remove('avant','apres')})});
    li.addEventListener('dragover',function(e){
      if(!glisse||glisse===li.dataset.id)return;e.preventDefault();
      var r=li.getBoundingClientRect(),apres=e.clientY>r.top+r.height/2;
      li.classList.toggle('apres',apres);li.classList.toggle('avant',!apres);
    });
    li.addEventListener('dragleave',function(){li.classList.remove('avant','apres')});
    li.addEventListener('drop',function(e){
      e.preventDefault();if(!glisse||glisse===li.dataset.id)return;
      var apres=li.classList.contains('apres'),de=DOSSIERS.findIndex(function(d){return d.id===glisse}),bouge=DOSSIERS.splice(de,1)[0];
      var vers=DOSSIERS.findIndex(function(d){return d.id===li.dataset.id});
      DOSSIERS.splice(apres?vers+1:vers,0,bouge);
      glisse=null;sauverAdm();recalc();rendreSets();toast('Ordre des catégories mis à jour.');
    });
  });
}
function deplacerSet(id,sens){
  var i=DOSSIERS.findIndex(function(d){return d.id===id}),j=i+sens;
  if(j<0||j>=DOSSIERS.length)return;
  var x=DOSSIERS[i];DOSSIERS[i]=DOSSIERS[j];DOSSIERS[j]=x;sauverAdm();recalc();rendreSets();
}
function menuSet(btn,id){
  var i=DOSSIERS.findIndex(function(d){return d.id===id});
  var h=itemPop('modifier',I.crayon,'Modifier')+
    (i>0?itemPop('monter',I.haut,'Monter'):'')+(i<DOSSIERS.length-1?itemPop('descendre',I.bas,'Descendre'):'')+
    '<div class="pop-sep"></div>'+itemPop('supprimer',I.corbeille,'Supprimer');
  pop(btn,h,function(m){m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    fermerPop();var a=b.dataset.a;
    if(a==='modifier')fenetreSet(id);else if(a==='monter')deplacerSet(id,-1);else if(a==='descendre')deplacerSet(id,1);else supprimerSet(id);
  }})});
}
function fenetreSet(id){
  var d=id?dossierPar(id):{nom:'',desc:''};
  fenetre('<div class="partage-tete"><h2>'+(id?'Modifier la catégorie':'Nouvelle catégorie')+'</h2><button class="ibtn" data-ferme aria-label="Fermer">'+I.fermer+'</button></div>'+
    '<div class="champ"><label for="set-nom">Nom de la catégorie</label><input type="text" id="set-nom" maxlength="60" value="'+esc(d.nom)+'" placeholder="Par exemple : Préparatifs"></div>'+
    '<div class="champ"><label for="set-desc">Description</label><textarea id="set-desc" maxlength="500" rows="5" placeholder="Facultatif">'+esc(d.desc||'')+'</textarea>'+
    '<div class="compteur num" id="set-compte"></div><p class="note">La description s’affiche à vos clients en haut de cette catégorie, pour raconter le moment.</p></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="set-ok">Enregistrer</button></div>');
  function compte(){$('set-compte').textContent=$('set-desc').value.length+' / 500'}
  compte();$('set-desc').oninput=compte;$('set-nom').focus();
  $('set-ok').onclick=function(){
    var nom=$('set-nom').value.trim();if(!nom){$('set-nom').focus();toast('Donnez un nom à la catégorie.');return}
    if(id){d.nom=nom;d.desc=$('set-desc').value.trim()}
    else{var nid='cat'+Date.now();DOSSIERS.push({id:nid,nom:nom,desc:$('set-desc').value.trim()});admSet=nid}
    sauverAdm();fermerFenetre();rendreAdmin();toast(id?'Catégorie enregistrée.':'Catégorie créée. Ajoutez-y des photos.');
  };
}
function supprimerSet(id){
  var d=dossierPar(id);
  fenetre('<h2>Supprimer « '+esc(d.nom)+' » ?</h2><p>'+(d.n?'Ses '+d.n+' photos seront retirées de la galerie. ':'')+'Vos clients ne verront plus cette catégorie. Vos fichiers sur votre ordinateur ne sont pas touchés.</p>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn danger" id="set-suppr">Supprimer</button></div>');
  $('set-suppr').onclick=function(){
    var b=this,aSuppr=PHOTOS.filter(function(p){return p.dossier===id});b.disabled=true;b.textContent='Suppression…';
    aSuppr.reduce(function(pr,p){return pr.then(function(){return api('photos/'+p.id,{method:'DELETE'})})},Promise.resolve()).then(function(){
      DOSSIERS.splice(DOSSIERS.findIndex(function(x){return x.id===id}),1);
      return sauverAdm(true);
    }).then(function(){fermerFenetre();toast('Catégorie supprimée.');return recharger()}).catch(function(e){toast(e.message)});
  };
}

/* ---- Grille des photos d'une catégorie ---- */
function rendreSetMain(){
  rendreSetMainBase();if(SEANCE)rendreEtapes();
}
function rendreSetMainBase(){
  var d=dossierPar(admSet),main=$('adm-main');
  if(selAdmCtx!==CID+'/'+admSet){SELADM.clear();selAdmCtx=CID+'/'+admSet}
  if(!d){
    var seanceSel=SEANCE&&!LIVRE(),nomDef=SEANCE?'Séance':EVT()?'Photos':'Cérémonie';
    main.innerHTML='<div class="vide"><h3>Aucune catégorie</h3><span>Créez une première catégorie pour y ranger vos photos.</span></div>'+
      '<label class="depot depot-vide" id="vide-depot"><input type="file" id="vide-input" multiple accept="'+(seanceSel?'.nef,.raf,.cr2,.cr3,.arw,.dng,.jpg,.jpeg,image/jpeg':'image/jpeg,.jpg,.jpeg')+'" hidden><b>'+(seanceSel?'Glissez vos RAW ici':'Glissez vos photos ici')+'</b>ou cliquez pour les choisir</label>'+
      '<p class="note depot-vide-note">Une catégorie « '+nomDef+' » est créée automatiquement. Vous pourrez la renommer ensuite.</p>';
    // Dépôt direct : on crée la catégorie, puis on ouvre la fenêtre d'envoi avec les photos déjà choisies
    lierDepot($('vide-depot'),$('vide-input'),function(fs){
      if(!fs.length)return;
      var nid='cat'+Date.now(),nd={id:nid,nom:nomDef,desc:''};DOSSIERS.push(nd);admSet=nid;
      sauverAdm(true).then(function(){rendreAdmin();if(seanceSel)fenetreImport(fs);else fenetreAjout(nd,fs)});
    });
    return;
  }
  var libAjout=SEANCE&&!LIVRE()?'Importer des RAW':'Ajouter des photos';
  var photos=PHOTOS.filter(function(p){return p.dossier===d.id}),fav=tousFavoris();
  main.innerHTML='<div class="adm-main-tete"><h2>'+esc(d.nom)+'</h2><div class="outils-adm">'+
      '<button class="ibtn" id="adm-tri" title="Trier les photos" aria-label="Trier les photos" aria-haspopup="menu">'+I.tri+'</button>'+
      '<button class="ibtn" id="adm-grille" title="Affichage de la grille" aria-label="Affichage de la grille" aria-haspopup="menu">'+I.grille+'</button>'+
      '<span class="sep-v"></span><button class="txtbtn" id="adm-ajout">'+I.plusRond+libAjout+'</button></div></div>'+
    (d.desc?'<p class="adm-desc">'+esc(d.desc)+'</p>':'')+
    '<div class="sel-adm" id="sel-adm" hidden><span id="sel-adm-n"></span><button class="lienbtn" id="sel-adm-tout">Tout sélectionner</button><button class="lienbtn" id="sel-adm-annuler">Annuler</button><button class="btn clair" id="sel-adm-deplacer" aria-haspopup="menu">'+I.deplacer+'Déplacer vers</button><button class="btn danger" id="sel-adm-suppr">'+I.corbeille+'Supprimer</button></div>'+
    (photos.length?'<div class="grille-adm g-'+ADM.grille+(ADM.fichiers?'':' sans-noms')+(SELADM.size?' mode-sel':'')+'">'+photos.map(function(p){
      var coche=SELADM.has(p.id);
      return '<figure class="cell'+(coche?' coche':'')+'" data-pid="'+p.id+'"><div class="cadre"><button class="cell-case" data-case="'+p.id+'" role="checkbox" aria-checked="'+coche+'" title="Sélectionner" aria-label="Sélectionner '+esc(p.nom)+'">'+I.check+'</button><img loading="lazy" decoding="async" src="'+SRC(p.n,'mini')+'" alt=""><span class="cell-outils"><button class="cell-btn" data-couv="'+p.id+'" title="Utiliser comme couverture" aria-label="Utiliser comme couverture">'+I.image+'</button><button class="cell-btn" data-suppr="'+p.id+'" title="Supprimer la photo" aria-label="Supprimer la photo">'+I.corbeille+'</button></span></div>'+
        ((fav[p.id]||estAlbum(p.id))?'<div class="etats">'+(fav[p.id]?'<span title="Favori du client">'+I.coeurPlein+'</span>':'')+(estAlbum(p.id)?'<span class="al" title="'+TXT.dans+'">'+I.albumPlein+'</span>':'')+'</div>':'')+
        '<figcaption title="'+esc(p.nom)+'">'+esc(p.nom)+'</figcaption></figure>';
    }).join('')+'</div>':'<div class="vide"><h3>Catégorie vide</h3><span>Ajoutez des photos pour qu’elle apparaisse dans la galerie de vos clients.</span></div>');
  $('adm-tri').onclick=function(e){e.stopPropagation();
    pop(this,'<div class="pop-label">Trier les photos</div>'+itemPop('asc',null,'Nom de fichier (A → Z)',ADM.tri==='asc')+itemPop('desc',null,'Nom de fichier (Z → A)',ADM.tri==='desc')+'<p class="pop-note">Le tri s’applique aussi à la galerie de vos clients.</p>',function(m){
      m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){ADM.tri=b.dataset.a;sauverAdm();recalc();fermerPop();rendreSetMain()}})});
  };
  $('adm-grille').onclick=function(e){e.stopPropagation();
    pop(this,'<div class="pop-label">Taille de la grille</div>'+itemPop('petite',null,'Petite',ADM.grille==='petite')+itemPop('grande',null,'Grande',ADM.grille==='grande')+
      '<div class="pop-sep"></div><div class="pop-label">Afficher</div><label class="pop-item interrupteur"><span>Nom de fichier</span><input type="checkbox" id="tg-fichiers"'+(ADM.fichiers?' checked':'')+'><i></i></label>',function(m){
      m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){ADM.grille=b.dataset.a;sauverAdm();fermerPop();rendreSetMain()}});
      $('tg-fichiers').onchange=function(){ADM.fichiers=this.checked;sauverAdm();var g=document.querySelector('.grille-adm');if(g)g.classList.toggle('sans-noms',!ADM.fichiers)};
    });
  };
  $('adm-ajout').onclick=function(){if(SEANCE&&!LIVRE())fenetreImport();else fenetreAjout(d)};
  main.querySelectorAll('[data-suppr]').forEach(function(b){b.onclick=function(e){e.stopPropagation();supprimerPhoto(parId(+b.dataset.suppr))}});
  // Sélection multiple : case en haut à droite (au survol), clic sur la photo une fois en mode sélection, Maj+clic pour une plage
  var ids=photos.map(function(p){return p.id}),grille=main.querySelector('.grille-adm');
  function basculer(id,force){var on=force===undefined?!SELADM.has(id):force;if(on)SELADM.add(id);else SELADM.delete(id);var c=main.querySelector('.cell[data-pid="'+id+'"]');if(c){c.classList.toggle('coche',on);c.querySelector('.cell-case').setAttribute('aria-checked',on)}}
  function majSel(){var n=SELADM.size;$('sel-adm').hidden=!n;if(grille)grille.classList.toggle('mode-sel',n>0);$('sel-adm-n').textContent=n+' photo'+(n>1?'s':'')+' sélectionnée'+(n>1?'s':'');$('sel-adm-tout').hidden=ids.every(function(i){return SELADM.has(i)})}
  var dernier=null;
  function cliquer(id,e){
    if(e.shiftKey&&dernier!==null&&ids.indexOf(dernier)>-1){var a=ids.indexOf(dernier),b=ids.indexOf(id),on=!SELADM.has(id);ids.slice(Math.min(a,b),Math.max(a,b)+1).forEach(function(i){basculer(i,on)})}
    else basculer(id);
    dernier=id;majSel();
  }
  main.querySelectorAll('[data-case]').forEach(function(b){b.onclick=function(e){e.stopPropagation();cliquer(+b.dataset.case,e)}});
  main.querySelectorAll('.cell .cadre').forEach(function(c){c.addEventListener('click',function(e){if(!SELADM.size||e.target.closest('.cell-btn'))return;cliquer(+c.closest('.cell').dataset.pid,e)})});
  // Sélection au lasso : cliquer-glisser avec la souris (sur la grille ou dans la marge) coche toutes les photos touchées par le cadre
  main.onpointerdown=null;
  if(grille)main.onpointerdown=function(e){
    if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('button,a,input,label,select,textarea,[contenteditable],.sel-adm,.pop'))return;
    var g=main.querySelector('.grille-adm');if(g!==grille)return;
    // Glisser une photo déjà cochée : on emporte toute la sélection vers une catégorie de la colonne de gauche
    var cellCochee=e.target.closest('.cell.coche');
    if(cellCochee&&grille.contains(cellCochee)){glisserSel(e,cellCochee);return}
    var base=new Set(SELADM),cells=[].slice.call(grille.querySelectorAll('.cell')),boites=null,cadre=null,actif=false;
    var r0=grille.getBoundingClientRect(),x0=e.clientX-r0.left,y0=e.clientY-r0.top,cx=e.clientX,cy=e.clientY,defil=null,ot0=grille.offsetTop;
    var conteneur=(function(n){while(n&&n!==document.body){var s=getComputedStyle(n).overflowY;if((s==='auto'||s==='scroll')&&n.scrollHeight>n.clientHeight)return n;n=n.parentElement}return null})(grille.parentElement);
    e.preventDefault();
    function maj(){
      var r=grille.getBoundingClientRect(),x1=cx-r.left,y1=cy-r.top;
      var L=Math.min(x0,x1),T=Math.min(y0,y1),R=Math.max(x0,x1),B=Math.max(y0,y1);
      if(!actif){if(Math.abs(x1-x0)<6&&Math.abs(y1-y0)<6)return;actif=true;document.body.classList.add('en-lasso');
        cadre=document.createElement('div');cadre.className='lasso';grille.appendChild(cadre);
        boites=cells.map(function(c){var b=c.querySelector('.cadre').getBoundingClientRect();return{id:+c.dataset.pid,l:b.left-r.left,t:b.top-r.top,r:b.right-r.left,b:b.bottom-r.top}})}
      cadre.style.cssText='left:'+L+'px;top:'+T+'px;width:'+(R-L)+'px;height:'+(B-T)+'px';
      boites.forEach(function(b){var dedans=b.l<R&&b.r>L&&b.t<B&&b.b>T,on=dedans||base.has(b.id);if(on!==SELADM.has(b.id))basculer(b.id,on)});
      majSel();
      // la barre de sélection qui apparaît pousse la grille : on compense pour que les photos restent sous la souris
      var d=grille.offsetTop-ot0;if(d){ot0+=d;if(conteneur)conteneur.scrollTop+=d;else scrollBy(0,d);maj()}
    }
    function bouge(ev){cx=ev.clientX;cy=ev.clientY;maj();
      // défilement automatique près des bords
      var h=conteneur?conteneur.getBoundingClientRect():{top:0,bottom:innerHeight},v=0;
      if(actif){if(cy<h.top+60)v=-Math.ceil((h.top+60-cy)/4);else if(cy>h.bottom-60)v=Math.ceil((cy-h.bottom+60)/4)}
      clearInterval(defil);defil=null;
      if(v)defil=setInterval(function(){if(conteneur)conteneur.scrollTop+=v;else scrollBy(0,v);maj()},16);
    }
    function fin(){clearInterval(defil);removeEventListener('pointermove',bouge);removeEventListener('pointerup',fin);removeEventListener('pointercancel',fin);
      document.body.classList.remove('en-lasso');if(cadre)cadre.remove();
      if(actif){var stop=function(ev){ev.stopPropagation();ev.preventDefault()};addEventListener('click',stop,true);setTimeout(function(){removeEventListener('click',stop,true)},0)}
    }
    addEventListener('pointermove',bouge);addEventListener('pointerup',fin);addEventListener('pointercancel',fin);
  };
  function glisserSel(e,cell){
    e.preventDefault();
    var x0=e.clientX,y0=e.clientY,actif=false,fant=null,cible=null,n=SELADM.size;
    function viser(x,y){
      var el=document.elementFromPoint(x,y),li=el&&el.closest('.set[data-id]');
      if(li&&li.dataset.id===admSet)li=null;
      if(li!==cible){if(cible)cible.classList.remove('depot-ok');cible=li;if(cible)cible.classList.add('depot-ok')}
      if(fant){fant.classList.toggle('vise',!!cible);fant.querySelector('span').textContent=cible?'Déposer dans « '+((dossierPar(cible.dataset.id)||{}).nom||'')+' »':'Déposez sur une catégorie'}
    }
    function bouge(ev){
      if(!actif){if(Math.abs(ev.clientX-x0)<6&&Math.abs(ev.clientY-y0)<6)return;actif=true;document.body.classList.add('en-glisse-photos');
        var img=cell.querySelector('img');
        fant=document.createElement('div');fant.className='fantome-photos';
        fant.innerHTML=(img?'<img src="'+img.src+'" alt="">':'')+'<b>'+n+'</b><span>Déposez sur une catégorie</span>';
        document.body.appendChild(fant);
        document.querySelectorAll('.set[data-id]').forEach(function(li){if(li.dataset.id!==admSet)li.classList.add('depot-possible')});
      }
      fant.style.transform='translate('+(ev.clientX+14)+'px,'+(ev.clientY+14)+'px)';
      viser(ev.clientX,ev.clientY);
    }
    function fin(ev){
      removeEventListener('pointermove',bouge);removeEventListener('pointerup',fin);removeEventListener('pointercancel',fin);
      if(!actif)return;
      document.body.classList.remove('en-glisse-photos');if(fant)fant.remove();
      document.querySelectorAll('.set.depot-possible,.set.depot-ok').forEach(function(li){li.classList.remove('depot-possible','depot-ok')});
      var stop=function(x){x.stopPropagation();x.preventDefault()};addEventListener('click',stop,true);setTimeout(function(){removeEventListener('click',stop,true)},0);
      if(ev.type==='pointerup'&&cible)deplacerSel(cible.dataset.id);
    }
    addEventListener('pointermove',bouge);addEventListener('pointerup',fin);addEventListener('pointercancel',fin);
  }
  $('sel-adm-tout').onclick=function(){ids.forEach(function(i){basculer(i,true)});majSel()};
  $('sel-adm-annuler').onclick=function(){SELADM.forEach(function(i){basculer(i,false)});SELADM.clear();majSel()};
  $('sel-adm-suppr').onclick=function(){supprimerPhotos(Array.from(SELADM).map(parId).filter(Boolean))};
  // Déplacer la sélection dans une autre catégorie (ajoutée à la fin de celle-ci)
  function deplacerSel(cible){
    var nomC=(dossierPar(cible)||{}).nom||'',bouges=Array.from(SELADM),n=bouges.length;
    var deja=TOUTES.filter(function(p){return p.dossier===cible}).sort(function(a,b){return (a.ordre||0)-(b.ordre||0)}).map(function(p){return p.id});
    if($('sel-adm-deplacer'))$('sel-adm-deplacer').disabled=true;
    return api('collections/'+CID+'/ordre',{method:'POST',body:{ids:deja.concat(bouges),dossier:cible}}).then(function(){
      SELADM.clear();toast(n+' photo'+(n>1?'s':'')+' déplacée'+(n>1?'s':'')+' vers « '+nomC+' ».');return recharger();
    }).catch(function(err){toast(err.message);if($('sel-adm-deplacer'))$('sel-adm-deplacer').disabled=false});
  }
  // Déplacer la sélection dans une autre catégorie, existante ou créée sur le moment
  $('sel-adm-deplacer').onclick=function(e){e.stopPropagation();
    var autres=DOSSIERS.filter(function(x){return x.id!==d.id});
    pop(this,'<div class="pop-label">Déplacer vers la catégorie</div>'+autres.map(function(x){var k=TOUTES.filter(function(p){return p.dossier===x.id}).length;return itemPop(x.id,null,esc(x.nom),false,k+' photo'+(k>1?'s':''))}).join('')+
      (autres.length?'<div class="pop-sep"></div>':'')+itemPop('__nouvelle',I.plusRond,'Nouvelle catégorie…'),function(m){
      m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
        fermerPop();
        if(b.dataset.a!=='__nouvelle'){deplacerSel(b.dataset.a);return}
        var n=SELADM.size;
        fenetre(enteteFen('Nouvelle catégorie')+'<div class="champ"><label for="nd-nom">Nom de la catégorie</label><input type="text" id="nd-nom" maxlength="60" placeholder="Par exemple : Cocktail"></div>'+
          '<p class="note">Les '+n+' photo'+(n>1?'s':'')+' sélectionnée'+(n>1?'s':'')+' y seront déplacée'+(n>1?'s':'')+' tout de suite.</p>'+
          '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="nd-ok">Créer et déplacer</button></div>');
        $('nd-nom').focus();
        $('nd-nom').onkeydown=function(ev){if(ev.key==='Enter')$('nd-ok').click()};
        $('nd-ok').onclick=function(){
          var nom=$('nd-nom').value.trim();if(!nom){toast('Donnez un nom à la catégorie.');$('nd-nom').focus();return}
          this.disabled=true;var nid='cat'+Date.now();DOSSIERS.push({id:nid,nom:nom,desc:''});
          sauverAdm(true).then(function(){fermerPop();fermerFenetre();rendreSets();return deplacerSel(nid)});
        };
      }})});
  };

  majSel();
  main.querySelectorAll('[data-couv]').forEach(function(b){b.onclick=function(e){e.stopPropagation();ADM.couv=+b.dataset.couv;var ph=parId(ADM.couv);ADM.couvPos=ph&&ph.h>ph.w?'50% 35%':'50% 50%';sauverAdm(true).then(function(){genererMur()});rendreAdmin();toast('Couverture mise à jour.')}});
}
/* ---- Envoi des photos : versions web et miniature créées dans le navigateur, CRC calculé pour les ZIP ---- */
var TABLE_CRC=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(buf){var b=new Uint8Array(buf),c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=TABLE_CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function redimensionner(bmp,L,q){
  var s=Math.min(1,L/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
  c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
  var x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,c.width,c.height);
  return new Promise(function(r){c.toBlob(r,'image/jpeg',q)});
}
function envoyerVariante(id,v,blob,extra){
  return blob.arrayBuffer().then(function(buf){
    var qs='?crc='+crc32(buf)+(extra||'');
    function essai(n){return fetch('/admin/api/photos/'+id+'/'+v+qs,{method:'PUT',body:blob,credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('Envoi refusé ('+r.status+')');return r.json()}).catch(function(e){if(n>0)return new Promise(function(ok){setTimeout(ok,1500)}).then(function(){return essai(n-1)});throw e})}
    return essai(2);
  });
}
// Prépare et envoie une photo finale (HD + web 2048 px + miniature 800 px)
function envoyerUnePhoto(f,cible){
  return createImageBitmap(f).then(function(bmp){
    var w=bmp.width,h=bmp.height;
    return Promise.all([redimensionner(bmp,2048,.86),redimensionner(bmp,800,.8)]).then(function(v){
      if(bmp.close)bmp.close();
      var fiche=cible.final?api('collections/'+CID+'/photos',{method:'POST',body:{final:true,nom:f.name}}):api('collections/'+CID+'/photos',{method:'POST',body:{dossier:cible.dossier,nom:f.name,w:w,h:h}});
      return fiche.then(function(r){
        var dims='&w='+w+'&h='+h;
        return envoyerVariante(r.id,'hd',f,dims).then(function(){return envoyerVariante(r.id,'web',v[0])}).then(function(){return envoyerVariante(r.id,'mini',v[1])}).then(function(){return r});
      });
    });
  });
}
// File d'envoi avec 3 envois en parallèle et une barre de progression
function fileEnvoi(fichiers,tache,maj){
  var i=0,fait=0,erreurs=[],actifs=0;
  return new Promise(function(fin){
    function suivant(){
      if(i>=fichiers.length&&actifs===0){fin({fait:fait,erreurs:erreurs});return}
      while(actifs<3&&i<fichiers.length){
        (function(f){actifs++;tache(f).then(function(){fait++}).catch(function(e){erreurs.push(f.name+' : '+e.message)}).then(function(){actifs--;maj(fait,erreurs.length,fichiers.length);suivant()})})(fichiers[i++]);
      }
    }
    maj(0,0,fichiers.length);suivant();
  });
}
function blocProgression(){return '<div class="envoi-prog" id="envoi-prog" hidden><div class="jauge"><i id="envoi-jauge"></i></div><p class="note" id="envoi-txt"></p></div>'}
function majProgression(fait,err,total){
  if(!$('envoi-prog')||!$('envoi-jauge')||!$('envoi-txt'))return;
  $('envoi-prog').hidden=false;$('envoi-jauge').style.width=Math.round((fait+err)/total*100)+'%';
  $('envoi-txt').textContent=fait+' / '+total+' photo'+(total>1?'s':'')+' envoyée'+(fait>1?'s':'')+(err?' · '+err+' en erreur':'')+((fait+err)<total?' · gardez cette page ouverte':'');
}
/* ---- Suivi des envois en arrière-plan : visible dans la collection quand la fenêtre d'envoi est fermée ---- */
var SUIVI=null,suiviMinuteur=null;
function suiviAjouter(titre,n){
  if(!n)return;
  if(!SUIVI||SUIVI.fait+SUIVI.err>=SUIVI.total)SUIVI={titre:titre,total:0,fait:0,err:0,cid:CID,nom:ADM.nom||''};
  clearTimeout(suiviMinuteur);SUIVI.total+=n;SUIVI.titre=titre;suiviMaj();
}
function suiviPas(ok){if(!SUIVI)return;if(ok)SUIVI.fait++;else SUIVI.err++;suiviMaj()}
function suiviMaj(){
  if(MODE!=='admin')return;
  var el=$('suivi-envoi');
  if(!SUIVI){if(el)el.remove();return}
  if(!el){el=document.createElement('div');el.id='suivi-envoi';el.className='suivi-envoi';el.setAttribute('role','status');document.body.appendChild(el)}
  var s=SUIVI,fini=s.fait+s.err>=s.total,pct=s.total?Math.round((s.fait+s.err)/s.total*100):0;
  el.classList.toggle('fini',fini);
  el.innerHTML='<div class="se-haut"><b>'+esc(s.titre)+(s.cid!==CID&&s.nom?' · '+esc(s.nom):'')+'</b><span class="num">'+(s.fait+s.err)+' / '+s.total+'</span></div>'+
    '<div class="se-jauge"><i style="width:'+pct+'%"></i></div>'+
    '<small>'+(fini?(s.err?s.fait+' réussie'+(s.fait>1?'s':'')+' · '+s.err+' en erreur':'Terminé ✓'):pct+' % · gardez cette page ouverte')+'</small>';
  // Masqué tant que la fenêtre d'envoi est ouverte (elle a déjà sa propre progression)
  var fenEnvoi=!$('voile').hidden&&($('imp-depot')||$('depot'));
  el.hidden=!!fenEnvoi;
  if(fini){clearTimeout(suiviMinuteur);suiviMinuteur=setTimeout(function(){SUIVI=null;suiviMaj()},s.err?12000:5000)}
}
addEventListener('beforeunload',function(e){if(SUIVI&&SUIVI.fait+SUIVI.err<SUIVI.total){e.preventDefault();e.returnValue=''}});

/* ---- Aperçu miniature des photos choisies avant l'envoi ---- */
// Les miniatures sont fabriquées au fil du défilement (2 à la fois) pour rester fluide même avec 400 photos
function miniatureFichier(f){
  return createImageBitmap(f).then(function(b){
    var k=Math.min(1,240/Math.max(b.width,b.height)),c=document.createElement('canvas');c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);
    c.getContext('2d').drawImage(b,0,0,c.width,c.height);if(b.close)b.close();
    return new Promise(function(ok){c.toBlob(function(bl){ok(bl?URL.createObjectURL(bl):null)},'image/jpeg',.72)});
  }).catch(function(){return null});
}
function grilleVignettes(el,fichiers,retirer){
  (el._urls||[]).forEach(function(u){URL.revokeObjectURL(u)});el._urls=[];if(el._io)el._io.disconnect();
  el.hidden=!fichiers.length;
  el.innerHTML=fichiers.map(function(f,i){return '<figure class="vig" data-i="'+i+'" title="'+esc(f.name)+'"><span class="vig-nom">'+esc(f.name)+'</span>'+(retirer?'<button type="button" class="vig-x" data-x="'+i+'" aria-label="Retirer '+esc(f.name)+'">'+I.fermer+'</button>':'')+'</figure>'}).join('');
  var attente=[],actifs=0;
  function pomper(){
    while(actifs<2&&attente.length){(function(v){actifs++;miniatureFichier(fichiers[+v.dataset.i]).then(function(u){actifs--;if(u){el._urls.push(u);var im=new Image();im.alt='';im.src=u;v.insertBefore(im,v.firstChild);v.classList.add('pret')}pomper()})})(attente.shift())}
  }
  el._io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){el._io.unobserve(e.target);attente.push(e.target);pomper()}})},{root:el,rootMargin:'160px'});
  el.querySelectorAll('.vig').forEach(function(v){el._io.observe(v)});
  if(retirer)el.querySelectorAll('[data-x]').forEach(function(b){b.onclick=function(e){e.preventDefault();retirer(+b.dataset.x)}});
}
function etatVignette(el,i,etat){var v=el.querySelector('.vig[data-i="'+i+'"]');if(v){v.classList.remove('en-cours','envoye','erreur');if(etat)v.classList.add(etat)}}

function fenetreAjout(d,initiaux){
  fenetre(enteteFen('Ajouter des photos')+
    '<p>Dans « '+esc(d.nom)+' ». Déposez vos exports JPEG : les versions web et les miniatures sont créées automatiquement, et les fichiers originaux sont conservés pour le téléchargement en haute définition.</p>'+
    '<label class="depot" id="depot"><input type="file" id="fichiers" accept="image/jpeg,.jpg,.jpeg" multiple hidden><b>Glissez vos photos ici</b>ou cliquez pour les choisir</label>'+
    '<div id="vignettes" class="vignettes" hidden></div>'+
    '<div id="liste-fichiers" class="note"></div>'+blocProgression()+
    '<div class="ligne-btn"><button class="btn clair" data-ferme id="envoi-fermer">Fermer</button><button class="btn" id="envoi" disabled>Envoyer</button></div>');
  var choisis=[],envoiEnCours=false;
  function majChoix(){
    var tot=choisis.reduce(function(s,f){return s+f.size},0)/1e6;
    $('liste-fichiers').textContent=choisis.length?choisis.length+' photo'+(choisis.length>1?'s':'')+' · '+fmtPoids(tot)+' à envoyer':'Aucune photo JPEG reconnue.';
    $('envoi').disabled=!choisis.length;
    grilleVignettes($('vignettes'),choisis,function(i){if(envoiEnCours)return;choisis.splice(i,1);majChoix()});
  }
  function surFichiers(fs){
    choisis=fs.filter(function(f){return /\.jpe?g$/i.test(f.name)||f.type==='image/jpeg'});
    majChoix();
  }
  lierDepot($('depot'),$('fichiers'),surFichiers);
  if(initiaux&&initiaux.length)surFichiers(initiaux);
  $('envoi').onclick=function(){
    var b=this;b.disabled=true;envoiEnCours=true;$('depot').style.pointerEvents='none';$('envoi-fermer').textContent='Masquer';$('vignettes').classList.add('verrou');
    var vg=$('vignettes'),rang=new Map(choisis.map(function(f,i){return [f,i]}));
    suiviAjouter('Envoi des photos',choisis.length);fileEnvoi(choisis,function(f){var i=rang.get(f);etatVignette(vg,i,'en-cours');return envoyerUnePhoto(f,{dossier:d.id}).then(function(x){etatVignette(vg,i,'envoye');suiviPas(true);return x},function(e){etatVignette(vg,i,'erreur');suiviPas(false);throw e})},majProgression).then(function(r){
      $('envoi-fermer').textContent='Fermer';
      toast(r.fait+' photo'+(r.fait>1?'s':'')+' ajoutée'+(r.fait>1?'s':'')+(r.erreurs.length?' · '+r.erreurs.length+' en erreur':'')+'.');
      if(r.erreurs.length)$('liste-fichiers').innerHTML='<span class="err">'+r.erreurs.map(esc).join('<br>')+'</span>';
      else fermerFenetre();
      recharger().then(function(){genererMur()});
    });
  };
}
// Mur flouté de la page d'accès : mosaïque de petites photos générée ici puis envoyée
/* Bannière des e-mails : la photo de couverture, recadrée, avec le nom et le logo (comme l'e-mail du questionnaire) */
function genererBanniere(o){
  o=o||{};
  var n=CID&&PHOTOS.length&&couvAdm();if(!n)return Promise.resolve();
  // Séance : floutée pendant la sélection, nette (photo retouchée) à la livraison
  var flou=SEANCE&&!LIVRE()&&!o.net,src=null;
  if(SEANCE&&!flou){
    var prete=function(p){return p&&estAlbum(p.id)&&(VARS[p.id]||{}).web};
    if(!prete(parId(n))){var f=TOUTES.filter(prete)[0];if(!f)return Promise.resolve();n=f.n}
    src='/admin/api/img/'+CID+'/'+n+'/web';
  }
  var cid=CID,W=1120,H=760,R=56,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  function charger(src){return new Promise(function(ok){var im=new Image();im.onload=function(){ok(im)};im.onerror=function(){ok(null)};im.src=src})}
  var logo='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(LOGO_SVG.replace(' class="logo" aria-hidden="true"','').replace(/currentColor/g,'#FFFFFF'));
  var polices=(document.fonts&&document.fonts.load)?Promise.all([document.fonts.load('600 64px "Bricolage Grotesque"'),document.fonts.load('500 26px "Hanken Grotesk"')]).catch(function(){}):Promise.resolve();
  return Promise.all([charger(src||SRC(n,'web')).then(function(im){return im||charger(SRC(n,'mini'))}),charger(logo),polices]).then(function(r){
    var im=r[0],lg=r[1];if(!im)return;
    x.fillStyle='#F4EFE9';x.fillRect(0,0,W,H);
    x.save();x.beginPath();x.moveTo(R,0);x.arcTo(W,0,W,H,R);x.arcTo(W,H,0,H,R);x.arcTo(0,H,0,0,R);x.arcTo(0,0,W,0,R);x.closePath();x.clip();
    var pos=String(ADM.couvPos||'50% 50%').split(' ').map(function(v){return (parseFloat(v)||50)/100});
    var k=Math.max(W/im.naturalWidth,H/im.naturalHeight),dw=im.naturalWidth*k,dh=im.naturalHeight*k;
    var ix=(W-dw)*pos[0],iy=(H-dh)*(pos[1]===undefined?.5:pos[1]);
    if(flou){
      // Flou fiable sur tous les navigateurs : on réduit fortement l'image puis on l'agrandit en plusieurs passes
      var t=document.createElement('canvas'),tw=Math.round(W/22),th=Math.round(H/22);t.width=tw;t.height=th;
      var tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(im,ix/22,iy/22,dw/22,dh/22);
      var m=document.createElement('canvas');m.width=tw*4;m.height=th*4;var mx=m.getContext('2d');mx.imageSmoothingQuality='high';mx.drawImage(t,0,0,m.width,m.height);
      x.imageSmoothingQuality='high';x.drawImage(m,-20,-20,W+40,H+40);
      x.fillStyle='rgba(244,239,233,.12)';x.fillRect(0,0,W,H);
    } else x.drawImage(im,ix,iy,dw,dh);
    var g=x.createLinearGradient(0,H*.42,0,H);g.addColorStop(0,'rgba(28,21,13,0)');g.addColorStop(1,'rgba(28,21,13,.74)');x.fillStyle=g;x.fillRect(0,0,W,H);
    var lw=74,lh=lg?lw*lg.naturalHeight/lg.naturalWidth:0;if(lg)x.drawImage(lg,W-60-lw,H-56-lh,lw,lh);
    var titre=String(ADM.nom||'').replace(/^Séance famille\s+/i,'Famille ').replace(/^(Mariage|Séance couple|Séance maternité|Séance)\s+/i,''),t=70;
    x.fillStyle='#FFFFFF';x.textBaseline='alphabetic';
    do{x.font='600 '+t+'px "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';t-=2}while(x.measureText(titre).width>W-60-60-lw-30&&t>34);
    x.fillText(titre,60,H-104);
    x.font='500 27px "Hanken Grotesk", "Helvetica Neue", Arial, sans-serif';x.globalAlpha=.88;
    x.fillText((SEANCE?'Séance photo':EVT()?'Événement':'Mariage')+(ADM.dateEvt?' · '+dateFr(ADM.dateEvt):''),62,H-58);
    x.restore();
    return new Promise(function(ok){c.toBlob(ok,'image/jpeg',.86)}).then(function(bl){return fetch('/admin/api/collections/'+cid+'/banniere'+(flou?'?flou=1':''),{method:'PUT',body:bl,credentials:'same-origin'})});
  }).catch(function(){});
}
// Couverture : version HD (3200 px de large, 3840 px max en hauteur) préparée à partir du fichier original
var couvEnCours=null;
function sourceCouv(){var n=couvAdm();if(!n)return null;var a=VARS[n]||{},q=SELP()?'apercu':a.hd?'hd':a.web?'web':a.apercu?'apercu':'mini';return {n:n,q:q}}
function couvAJour(){var s=sourceCouv(),h=ADM.couvHd;return !s||(h&&+h.n===+s.n&&h.q===s.q&&h.r===2)}
function genererCouv(force){
  var s=sourceCouv();if(!CID||!s||(!force&&couvAJour()))return Promise.resolve();
  var cle=CID+'/'+s.n+'/'+s.q;if(couvEnCours===cle)return Promise.resolve();couvEnCours=cle;
  var cid=CID;
  return fetch('/admin/api/img/'+cid+'/'+s.n+'/'+s.q,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){return createImageBitmap(b)}).then(function(bmp){
    var k=Math.min(1,4000/bmp.width,6000/bmp.height),W=Math.round(bmp.width*k),H=Math.round(bmp.height*k),cur=bmp,cw=bmp.width,ch=bmp.height;
    // réduction par paliers (÷2) pour garder un rendu net
    while(cw/2>W){var t=document.createElement('canvas');t.width=Math.round(cw/2);t.height=Math.round(ch/2);var tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(cur,0,0,t.width,t.height);cur=t;cw=t.width;ch=t.height}
    var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(cur,0,0,W,H);
    if(bmp.close)bmp.close();
    return new Promise(function(ok){c.toBlob(ok,'image/jpeg',.9)});
  }).then(function(bl){
    if(!bl)throw 0;
    return fetch('/admin/api/collections/'+cid+'/couverture?n='+s.n+'&q='+s.q+'&r=2',{method:'PUT',body:bl,credentials:'same-origin'}).then(function(r){return r.json()});
  }).then(function(r){if(r&&r.couvHd&&CID===cid){ADM.couvHd=r.couvHd;majCouv();var b=$('adm-couv'),u=urlCouvHd(couvAdm());if(b&&u){b.style.backgroundImage='url('+u+'),url('+SRC(couvAdm())+')';b.style.backgroundPosition=ADM.couvPos+','+ADM.couvPos}}}).catch(function(){}).then(function(){couvEnCours=null});
}
// Image d'aperçu des liens partagés (1200 × 630) : la couverture recadrée, floutée pour une séance avant livraison
var partageEnCours=null;
function sourcePartage(){
  var n=CID&&PHOTOS.length&&couvAdm();if(!n)return null;
  var flou=SEANCE&&!LIVRE();
  if(SEANCE&&!flou){var prete=function(p){return p&&estAlbum(p.id)&&(VARS[p.id]||{}).web};if(!prete(parId(n))){var f=TOUTES.filter(prete)[0];if(!f)return null;n=f.n}}
  return {n:n,flou:flou,pos:String(ADM.couvPos||'50% 50%')};
}
function partageAJour(){var s=sourcePartage(),h=ADM.partage;return !s||(h&&+h.n===+s.n&&!!h.flou===s.flou&&h.pos===s.pos)}
function genererPartage(force){
  var s=sourcePartage();if(!s||(!force&&partageAJour()))return Promise.resolve();
  var cid=CID,cle=cid+'/'+s.n+'/'+s.flou+'/'+s.pos;if(partageEnCours===cle)return Promise.resolve();partageEnCours=cle;
  var W=1200,H=630,c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
  return new Promise(function(ok){var im=new Image();im.onload=function(){ok(im)};im.onerror=function(){ok(null)};im.src=s.flou?SRC(s.n,'web'):'/admin/api/img/'+cid+'/'+s.n+'/web'}).then(function(im){
    if(!im)throw 0;
    var pos=s.pos.split(' ').map(function(v){return (parseFloat(v)||50)/100});
    var k=Math.max(W/im.naturalWidth,H/im.naturalHeight),dw=im.naturalWidth*k,dh=im.naturalHeight*k,ix=(W-dw)*pos[0],iy=(H-dh)*(pos[1]===undefined?.5:pos[1]);
    x.fillStyle='#2A2117';x.fillRect(0,0,W,H);x.imageSmoothingQuality='high';
    if(s.flou){
      var t=document.createElement('canvas'),tw=Math.round(W/22),th=Math.round(H/22);t.width=tw;t.height=th;
      var tx=t.getContext('2d');tx.imageSmoothingQuality='high';tx.drawImage(im,ix/22,iy/22,dw/22,dh/22);
      var m=document.createElement('canvas');m.width=tw*4;m.height=th*4;var mx=m.getContext('2d');mx.imageSmoothingQuality='high';mx.drawImage(t,0,0,m.width,m.height);
      x.drawImage(m,-20,-20,W+40,H+40);
    } else x.drawImage(im,ix,iy,dw,dh);
    return new Promise(function(ok){c.toBlob(ok,'image/jpeg',.85)});
  }).then(function(bl){
    if(!bl)throw 0;
    return fetch('/admin/api/collections/'+cid+'/partage?n='+s.n+'&flou='+(s.flou?1:0)+'&pos='+encodeURIComponent(s.pos),{method:'PUT',body:bl,credentials:'same-origin'}).then(function(r){return r.json()});
  }).then(function(r){if(r&&r.partage&&CID===cid)ADM.partage=r.partage}).catch(function(){}).then(function(){partageEnCours=null});
}
function genererMur(){
  genererBanniere();genererCouv();genererPartage();
  if(!CID||!PHOTOS.length)return Promise.resolve();
  var liste=PHOTOS.filter(function(p){return !LIVRE()||estAlbum(p.id)}),pas=Math.max(1,Math.floor(liste.length/80)),choix=[];
  for(var k=0;k<liste.length&&choix.length<80;k+=pas)choix.push(liste[k]);
  var H=170,G=0,W=3600,R=4,c=document.createElement('canvas');c.width=W;c.height=R*H+(R-1)*G;
  var x=c.getContext('2d');x.fillStyle='#FFFFFF';x.fillRect(0,0,c.width,c.height);
  return Promise.all(choix.map(function(p){return new Promise(function(ok){var im=new Image();im.onload=function(){ok(im)};im.onerror=function(){ok(null)};im.src=SRC(p.n,'mini')})})).then(function(imgs){
    imgs=imgs.filter(Boolean);if(!imgs.length)return;
    var i=0;
    for(var r=0;r<R;r++){var px=0;while(px<W){var im=imgs[i++%imgs.length],w=Math.round(im.naturalWidth*H/im.naturalHeight);x.drawImage(im,px,r*(H+G),w,H);px+=w+G}}
    return new Promise(function(ok){c.toBlob(ok,'image/jpeg',.72)}).then(function(bl){return fetch('/admin/api/collections/'+CID+'/mur',{method:'PUT',body:bl,credentials:'same-origin'})});
  }).catch(function(){});
}
function supprimerPhotos(liste){
  if(!liste.length)return;
  var n=liste.length,pl=n>1?'s':'';
  fenetre('<h2>Supprimer '+n+' photo'+pl+' ?</h2><p>'+(n>1?'Ces photos seront retirées':'Cette photo sera retirée')+' de la galerie et de votre stockage en ligne. Les fichiers sur votre ordinateur ne sont pas touchés.</p>'+
    '<div class="envoi-prog" id="sg-prog" hidden><div class="jauge"><i id="sg-jauge"></i></div><p class="note" id="sg-txt"></p></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn danger" id="sg-ok">'+I.corbeille+'Supprimer '+n+' photo'+pl+'</button></div>');
  $('sg-ok').onclick=function(){
    this.disabled=true;$('sg-prog').hidden=false;
    var i=0,fait=0,erreurs=0,actifs=0;
    function maj(){$('sg-jauge').style.width=Math.round((fait+erreurs)/n*100)+'%';$('sg-txt').textContent=fait+' / '+n+' supprimée'+(fait>1?'s':'')+(erreurs?' · '+erreurs+' en erreur':'')}
    new Promise(function(fin){
      function suivant(){
        if(i>=n&&actifs===0){fin();return}
        while(actifs<4&&i<n){(function(p){actifs++;api('photos/'+p.id,{method:'DELETE'}).then(function(){fait++;SELADM.delete(p.id)},function(){erreurs++}).then(function(){actifs--;maj();suivant()})})(liste[i++])}
      }
      maj();suivant();
    }).then(function(){
      fermerFenetre();toast(fait+' photo'+(fait>1?'s':'')+' supprimée'+(fait>1?'s':'')+(erreurs?' · '+erreurs+' en erreur':'')+'.');
      return recharger().then(function(){genererMur()});
    });
  };
}
function supprimerPhoto(p){
  fenetre('<h2>Supprimer cette photo ?</h2><p>« '+esc(p.nom)+' » sera retirée de la galerie et de votre stockage en ligne. Le fichier sur votre ordinateur n’est pas touché.</p><div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn danger" id="sp-ok">Supprimer</button></div>');
  $('sp-ok').onclick=function(){this.disabled=true;api('photos/'+p.id,{method:'DELETE'}).then(function(){fermerFenetre();toast('Photo supprimée.');return recharger()}).catch(function(e){toast(e.message)})};
}

/* ---- Menu Plus ---- */
function menuPlus(btn){
  var h=itemPop('lien',I.lien,'Obtenir le lien direct')+itemPop('emails',I.historique,'Historique des e-mails')+itemPop('presets',I.reglages,'Gérer les préréglages')+
    itemPop('deplacer',I.deplacer,'Déplacer vers')+itemPop('dupliquer',I.dupliquer,'Dupliquer')+itemPop('supprimer',I.corbeille,'Supprimer la collection');
    // « Créer un style » : masqué pour le moment (fenetreStyle reste disponible pour plus tard)
  pop(btn,h,function(m){m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){fermerPop();({
    lien:fenetreLien,emails:fenetreEmails,presets:fenetrePresets,deplacer:fenetreDeplacer,dupliquer:fenetreDupliquer,supprimer:fenetreSupprimer,style:fenetreStyle
  })[b.dataset.a]()}})});
}
function enteteFen(t){return '<div class="partage-tete"><h2>'+t+'</h2><button class="ibtn" data-ferme aria-label="Fermer">'+I.fermer+'</button></div>'}
function fenetreLien(){
  fenetre(enteteFen('Lien direct')+'<p>Le lien qui ouvre directement cette collection.'+(ADM.sansCode?' Aucun code n’est demandé : seulement l’e-mail du visiteur.':' Vos clients devront saisir leur code d’accès.')+'</p>'+
    '<div class="lien"><input type="text" id="lien-direct" readonly value="'+lienGalerie()+'" aria-label="Lien direct"><button class="btn" id="lien-copier">Copier</button></div>');
  $('lien-copier').onclick=function(){copier(lienGalerie(),'Lien copié.')};
}
function fenetreEmails(){
  var l=emails();
  fenetre(enteteFen('Historique des e-mails')+'<p>Tous les e-mails envoyés depuis cette collection.</p>'+
    '<div class="tableau"><table><thead><tr><th>Date</th><th>Destinataire</th><th>Objet</th><th>Statut</th></tr></thead><tbody>'+
    l.map(function(m){return '<tr><td>'+m.d+'</td><td>'+esc(m.a)+'</td><td>'+esc(m.o)+'</td><td><span class="etat '+(m.e==='envoyé'?'ok':m.e.indexOf('échec')===0?'alerte':'cours')+'">'+esc(m.e)+'</span></td></tr>'}).join('')+
    '</tbody></table></div>'+(l.length?'':'<p class="note">Aucun e-mail envoyé pour l’instant.</p>'));
}
function fenetrePresets(){
  fenetre(enteteFen('Préréglages')+'<p>Les réglages appliqués automatiquement quand vous créez une nouvelle collection.</p>'+
    '<div class="options">'+
    '<div class="option"><span class="g"><span><b>Mariage</b><small>En ligne 6 mois · sélection album de 60 photos · HD pour le couple · code invité en taille web · relance toutes les 2 semaines · rappel 30 et 7 jours avant expiration</small></span></span></div>'+
    '<div class="option"><span class="g"><span><b>Séance photo</b><small>Couple, famille, maternité · sélection sur aperçus filigranés · 15 photos incluses, 10 € la photo supplémentaire · livraison sur le même lien</small></span></span></div>'+
    '<div class="option"><span class="g"><span><b>Événement</b><small>En ligne 3 mois · pas d’album · rappel avant expiration</small></span></span></div>'+
    '</div><p class="note">Tout reste modifiable collection par collection, dans ses réglages.</p><div class="ligne-btn"><button class="btn" data-ferme>Fermer</button></div>');
}
function fenetreDeplacer(){
  fenetre(enteteFen('Déplacer vers')+'<p>Rangez cette collection dans un dossier de votre espace.</p><div class="options">'+
    CLASSEURS.map(function(c){return '<label class="option"><span class="g"><input type="radio" name="classeur" value="'+esc(c)+'"'+(c===ADM.classeur?' checked':'')+'><span>'+esc(c)+'</span></span></label>'}).join('')+
    '</div><div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="deplacer-ok">Déplacer</button></div>');
  $('deplacer-ok').onclick=function(){ADM.classeur=document.querySelector('[name=classeur]:checked').value;sauverAdm(true);fermerFenetre();rendreAdmin();toast('Collection déplacée dans « '+ADM.classeur+' ».')};
}
function fenetreDupliquer(){
  fenetre(enteteFen('Dupliquer la collection')+'<p>Une copie est créée avec les mêmes catégories et réglages, sans les photos, en statut cachée. Les favoris, la sélection d’album et les statistiques des clients ne sont pas copiés.</p>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="dup-ok">Dupliquer</button></div>');
  $('dup-ok').onclick=function(){this.disabled=true;api('collections/'+CID+'/dupliquer',{method:'POST',body:{}}).then(function(r){fermerFenetre();toast('Copie créée (cachée, sans les photos).');return ouvrirCollection(r.id)}).catch(function(e){toast(e.message)})};
}
function fenetreSupprimer(){
  fenetre('<h2>Supprimer la collection ?</h2><p>La galerie et toutes ses photos en ligne seront supprimées définitivement. Vos clients ne pourront plus y accéder. Vos fichiers sur votre ordinateur ne sont pas touchés.</p>'+
    '<label class="option"><span class="g"><input type="checkbox" id="suppr-ok-case"><span>Je comprends que cette action est définitive</span></span></label>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn danger" id="suppr-ok" disabled>Supprimer</button></div>');
  $('suppr-ok-case').onchange=function(){$('suppr-ok').disabled=!this.checked};
  $('suppr-ok').onclick=function(){this.disabled=true;api('collections/'+CID,{method:'DELETE'}).then(function(){fermerFenetre();toast('Collection supprimée.');retourCollections()}).catch(function(e){toast(e.message)})};
}
function fenetreStyle(){
  fenetre(enteteFen('Créer un style')+'<p>Un style enregistre l’apparence de cette galerie (couverture, typographies, couleurs, grille) pour l’appliquer en un clic à vos prochaines collections.</p><p class="note">Nous définirons les styles ensemble lors de l’étape design.</p><div class="ligne-btn"><button class="btn" data-ferme>Compris</button></div>');
}

/* ---- Partage côté photographe ---- */
function salutAdm(){return EVT()?'Bonjour,':'Bonjour '+prenomsAdm()+','}
function prenomsAdm(){var n=nomsCouple(ADM.nom);return /^Famille\s/i.test(ADM.nom)?'à toute la famille '+ADM.nom.replace(/^Famille\s+/i,''):n.replace(/\s*&\s*/,' et ')}
function sansMentionCode(t){
  if(!ADM.sansCode)return t;
  return String(t||'').replace(/Ce lien et ce code peuvent être partagés librement([^:\n]*?)\s*:[^\n]*/g,'Ce lien peut être partagé librement$1.').replace(/,? au même endroit et avec le même code/g,', au même endroit')
    .split('\n').filter(function(l){return !/^\s*(votre\s+)?code\b[^:]*:/i.test(l)}).join('\n').replace(/\n{3,}/g,'\n\n');
}
function texteInvitation(){return sansMentionCode(texteInvitationBrut())}
function texteInvitationBrut(){
  if(EVT())return 'Bonjour,\n\nMerci encore pour votre confiance, ce fut un plaisir de couvrir '+ADM.nom+'.\n\nLes photos sont en ligne ! Vous pouvez les découvrir et les télécharger ici :\n'+lienGalerie()+'\n\nCode d’accès : '+ADM.code+'\n\nCe lien et ce code peuvent être partagés librement avec vos équipes, vos partenaires et les participants : chacun accède à la galerie avec le même code.\n\nLa galerie reste en ligne jusqu’au '+dateFr(ADM.expiration)+'.\n\nBelle découverte,\nMélissa';
  var corps=SEANCE?(LIVRE()?'Vos photos retouchées sont prêtes ! Vous pouvez les découvrir et les télécharger en haute définition ici :':'Vos photos sont prêtes à être découvertes ! Choisissez celles que vous souhaitez recevoir retouchées : votre formule en comprend '+ADM.quota+'. Tout se passe ici :')
    :'Vos photos de mariage sont prêtes ! Vous pouvez les découvrir, les télécharger'+(ADM.albumActif!==false?' et choisir vos photos pour l’album':'')+' ici :';
  var merci=SEANCE?'Merci encore pour votre confiance, c’était un vrai plaisir de vous photographier.':'Merci encore pour votre confiance : c’était un vrai bonheur de vivre et de photographier votre mariage à vos côtés.';
  return salutAdm()+'\n\n'+merci+'\n\n'+corps+'\n'+lienGalerie()+'\n\nVotre code d’accès : '+ADM.code+(SEANCE&&!LIVRE()?'':'\nCode pour vos invités : '+ADM.codeInvite)+'\n\nLa galerie reste en ligne jusqu’au '+dateFr(ADM.expiration)+'.\n\nBelle découverte,\nMélissa';
}
function fenetrePartageAdm(){
  fenetre(enteteFen('Partager la collection')+
    (ADM.statut!=='publiee'?'<div class="indic attente">'+I.oeilBarre+'<div><b>Collection '+STATUTS[ADM.statut].nom.toLowerCase()+'</b><span>Publiez-la pour que vos clients puissent l’ouvrir</span></div><button class="btn clair" id="pa-publier">Publier</button></div>':'')+
    '<div class="champ"><label>Lien de la galerie</label><div class="lien"><input type="text" readonly value="'+lienGalerie()+'" aria-label="Lien de la galerie"><button class="btn" id="pa-lien">Copier</button></div></div>'+
    (ADM.sansCode?'<div class="indic ok">'+I.lien+'<div><b>Galerie sans code</b><span>Toute personne qui a le lien ouvre la galerie : seul son e-mail lui est demandé.</span></div></div>':EVT()?'<div class="codes"><div><span class="etiquette">Code d’accès unique</span><b class="num">'+esc(ADM.code)+'</b><button class="txtbtn" id="pa-c1">Copier</button></div><div><p class="note" style="margin:0">Le même code pour tout le monde : organisateurs, équipes, partenaires et participants.</p></div></div>':
    '<div class="codes"><div><span class="etiquette">Code couple</span><b class="num">'+esc(ADM.code)+'</b><button class="txtbtn" id="pa-c1">Copier</button></div><div><span class="etiquette">Code invités</span><b class="num">'+esc(ADM.codeInvite)+'</b><button class="txtbtn" id="pa-c2">Copier</button></div></div>')+
    '<div class="champ"><label for="pa-a">Envoyer par e-mail à</label><input type="text" id="pa-a" value="'+esc((ADM.contacts||[]).join(', '))+'" placeholder="prenom@exemple.fr, autre@exemple.fr"><p class="note">Ces adresses sont mémorisées : elles recevront aussi les relances, les rappels et l’avis de livraison.</p></div>'+
    '<div class="champ"><label for="pa-o">Objet</label><input type="text" id="pa-o" value="'+esc(SEANCE?(LIVRE()?'Vos photos sont prêtes':'Vos photos vous attendent'):EVT()?'Les photos de '+ADM.nom+' sont en ligne':'Vos photos de mariage sont prêtes')+'"></div>'+
    '<div class="champ"><label for="pa-m">Message</label><textarea id="pa-m" rows="10">'+esc(texteInvitation())+'</textarea></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Fermer</button><button class="btn" id="pa-envoi">'+I.envoyer+'Envoyer</button></div>');
  $('fenetre').classList.add('large-fen');
  if($('pa-publier'))$('pa-publier').onclick=function(){ADM.statut='publiee';sauverAdm(true).then(function(){genererMur()});rendreAdmin();fenetrePartageAdm();toast('Collection publiée.')};
  $('pa-lien').onclick=function(){copier(lienGalerie(),'Lien copié.')};
  if($('pa-c1'))$('pa-c1').onclick=function(){copier(ADM.code,EVT()?'Code d’accès copié.':'Code couple copié.')};
  if($('pa-c2'))$('pa-c2').onclick=function(){copier(ADM.codeInvite,'Code invités copié.')};
  $('pa-envoi').onclick=function(){
    var dest=$('pa-a').value.split(/[,;\s]+/).map(function(s){return s.trim()}).filter(function(s){return /^\S+@\S+\.\S+$/.test(s)});
    if(!dest.length){toast('Ajoutez au moins une adresse e-mail valide.');return}
    if(ADM.statut!=='publiee'&&!confirm('La collection n’est pas publiée : vos clients ne pourront pas l’ouvrir. Envoyer quand même ?'))return;
    var b=this;b.disabled=true;
    api('collections/'+CID+'/email',{method:'POST',body:{a:dest,objet:$('pa-o').value,texte:$('pa-m').value,memoriser:true,bouton:true}}).then(function(r){
      ADM.contacts=Array.from(new Set((ADM.contacts||[]).concat(dest)));fermerFenetre();
      toast((r.statut==='envoyé'?'E-mail envoyé à '+dest.length+' destinataire'+(dest.length>1?'s':'')+'.':'E-mail enregistré ('+r.statut+').')+(r.guide&&/^programmé/.test(r.guide)?' L’explication du livre photo partira dans 5 minutes.':''));
      recharger();
    }).catch(function(e){b.disabled=false;toast(e.message)});
  };
}
function envoyerSimple(objet,texte,msg){
  var a=ADM.contacts||[];if(!a.length){toast('Ajoutez d’abord l’adresse de vos clients dans Partager.');fenetrePartageAdm();return}
  api('collections/'+CID+'/email',{method:'POST',body:{a:a,objet:objet,texte:texte,bouton:true}}).then(function(){toast(msg);recharger()}).catch(function(e){toast(e.message)});
}
function menuPartage(btn){
  var h=itemPop('lien',I.lien,'Copier le lien de la galerie')+(ADM.sansCode?'':itemPop('invite',I.partage,EVT()?'Copier le lien et le code d’accès':'Copier le lien et le code invités'))+itemPop('rappel',I.mail,'Envoyer un rappel d’expiration');
  pop(btn,h,function(m){m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){
    fermerPop();var a=b.dataset.a;
    if(a==='lien')copier(lienGalerie(),'Lien copié.');
    else if(a==='invite'&&EVT())copier('Les photos de '+ADM.nom+' : '+lienGalerie()+' (code : '+ADM.code+')','Lien et code copiés : prêts à coller dans un message.');
    else if(a==='invite')copier('Les photos '+(SEANCE?'de notre séance':'du mariage de '+nomsCouple(ADM.nom))+' : '+lienGalerie()+' (code : '+ADM.codeInvite+')','Lien et code invités copiés : prêts à coller dans un message.');
    else envoyerSimple('Votre galerie ferme le '+dateFr(ADM.expiration),salutAdm()+'\n\nVotre galerie photo reste en ligne jusqu’au '+dateFr(ADM.expiration)+'. Pensez à télécharger vos photos en haute définition d’ici là pour les garder en sécurité.\n\nCode d’accès : '+ADM.code+'\n\nMélissa','Rappel d’expiration envoyé.');
  }})});
}

/* ---- Onglet Activité ---- */
function rendreActivite(){
  $('adm-side').innerHTML='<div class="sets-tete"><span class="etiquette">Activité</span></div><ul class="sets">'+
    [['act-fil','Activité récente'],['act-chiffres','Vue d’ensemble'],['act-sauvegarde',EVT()?'Sauvegarde du client':'Sauvegarde du couple'],['act-album',TXT.titreSel],['act-best','Meilleures photos'],['act-vis','Visiteurs'],['act-dl','Téléchargements']].filter(function(s){return !(EVT()&&s[0]==='act-album')}).map(function(s){return '<li class="set" tabindex="0" data-cible="'+s[0]+'"><span class="set-nom">'+s[1]+'</span></li>'}).join('')+'</ul>';
  $('adm-side').querySelectorAll('[data-cible]').forEach(function(li){li.onclick=function(){var c=$(li.dataset.cible);if(c)c.scrollIntoView({behavior:'smooth',block:'start'})}});
  var D=DONNEES||{visiteurs:[],telechargements:[],favoris:[]};
  var na=etat.album.length,maintenant=Date.now(),J=864e5;
  var jours=Math.ceil((new Date(ADM.expiration+'T12:00:00')-new Date())/J);
  var visites=D.visiteurs.reduce(function(s,v){return s+v.visites},0);
  var hdDl=D.telechargements.filter(function(x){return x.qualite==='hd'}).reduce(function(s,x){return s+x.nb},0);
  var favUniques={};D.favoris.forEach(function(f){favUniques[f.photo_id]=(favUniques[f.photo_id]||0)+1});
  var couple=D.visiteurs.filter(function(v){return v.role==='couple'}).map(function(v){return v.derniere}).sort().pop();

  /* 1. Sauvegarde HD du couple */
  var sv=ADM.sauvegarde;
  var leClient=EVT()?'Le client':'Le couple';
  var blocSauvegarde='<div class="bloc" id="act-sauvegarde"'+(EVT()?' style="grid-column:1/-1"':'')+'><h2>'+(EVT()?'Sauvegarde du client':'Sauvegarde du couple')+'</h2>'+
    (sv?'<div class="indic ok">'+I.check+'<div><b>Galerie complète téléchargée en HD</b><span>le '+dateHeure(sv)+'</span></div></div><p class="note">'+leClient+' a récupéré tous ses fichiers originaux. Vous pouvez archiver la galerie sereinement à son expiration.</p>'
       :'<div class="indic '+(jours<=30?'alerte':'attente')+'">'+I.dl+'<div><b>Pas encore téléchargée</b><span>La galerie expire dans '+jours+' jours</span></div></div>'+
        '<p class="note">'+leClient+' n’a pas encore téléchargé la galerie complète en HD. '+(jours<=30?'L’expiration approche : pensez à le relancer.':(ADM.rappel!==false?'Un rappel automatique partira 30 jours avant l’expiration.':''))+'</p>'+
        '<button class="btn clair" id="relance-sauvegarde">'+I.mail+'Envoyer un rappel de téléchargement</button>')+
    '</div>';

  /* 2. Sélection */
  var inactif=ADM.albumMaj?Math.floor((maintenant-ADM.albumMaj)/J):null;
  var blocAlbum=ADM.albumActif===false?'<div class="bloc" id="act-album"><h2>'+TXT.titreSel+'</h2><div class="indic attente">'+I.album+'<div><b>Option album désactivée</b><span>Le client ne voit pas la sélection d’album</span></div></div><p class="note">Activez-la si le couple ajoute un album à sa prestation. Sa sélection éventuelle est conservée.</p><div class="ligne-btn" style="justify-content:flex-start"><button class="btn clair" id="activer-album">Activer l’album</button></div></div>':
  '<div class="bloc" id="act-album"><h2>'+TXT.titreSel+'</h2>'+
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="etat '+(etat.verrou?'ok':'cours')+'">'+(etat.verrou?'Envoyée par le client':na?'En cours':'Pas encore commencée')+'</span><span class="num">'+na+' / '+QUOTA+'</span></div>'+
    '<div class="jauge" style="background:var(--sable-2)"><i style="width:'+Math.min(100,na/QUOTA*100)+'%"></i></div>'+
    '<dl class="dates">'+
      '<div><dt>Commencée</dt><dd>'+(ADM.albumDebut?dateHeure(ADM.albumDebut):'—')+'</dd></div>'+
      '<div><dt>Dernière modification</dt><dd>'+(ADM.albumMaj?depuis(ADM.albumMaj):'—')+'</dd></div>'+
      (ADM.albumValide?'<div><dt>Envoyée</dt><dd>'+dateHeure(ADM.albumValide)+'</dd></div>':'')+
    '</dl>'+
    (!etat.verrou&&inactif!==null&&inactif>=7?'<div class="indic alerte">'+I.historique+'<div><b>Aucune activité depuis '+inactif+' jours</b><span>La sélection semble en pause</span></div></div>':'')+
    (etat.verrou?'<p class="note">Un e-mail de notification vous a été envoyé avec le lien vers cette page.</p>':'')+
    '<div class="ligne-btn" style="justify-content:flex-start">'+
      (etat.verrou||LIVRE()?'':'<button class="btn clair" id="relance-album">'+I.mail+'Relancer le client</button>')+
      '<button class="btn clair" id="export-lr" '+(na?'':'disabled')+'>Copier la liste pour Lightroom</button>'+
      (etat.verrou&&!LIVRE()?'<button class="txtbtn" id="rouvrir-sel">Rouvrir la sélection</button>':'')+
      (na&&!LIVRE()?'<button class="txtbtn" id="reinit-sel">Réinitialiser la sélection</button>':'')+'</div>'+
    '</div>';

  /* 3. Fil d'activité */
  var fil=(ADM.journal||[]).slice(-14).reverse();
  var blocFil='<div class="bloc" id="act-fil"><div class="bloc-tete"><h2>Activité récente</h2><span class="etat cours">'+(EVT()?(couple?'Dernière visite : '+depuis(couple):'Personne n’a encore ouvert la galerie'):couple?'Dernière visite du couple : '+depuis(couple):'Le couple n’a pas encore ouvert la galerie')+'</span></div>'+
    (fil.length?'<ul class="fil">'+fil.map(function(e){return '<li><span class="puce-fil vraie"></span><div><b>'+esc(e.q)+'</b> '+esc(e.a)+'</div><time>'+depuis(e.t)+'</time></li>'}).join('')+'</ul>':'<p class="note">Rien pour l’instant : l’activité de vos clients apparaîtra ici.</p>')+'</div>';

  /* 4. Meilleures photos selon les clients */
  var dlParPhoto={};D.telechargements.forEach(function(x){if(x.photo_id)dlParPhoto[x.photo_id]=(dlParPhoto[x.photo_id]||0)+x.nb});
  var ids={};Object.keys(favUniques).concat(Object.keys(dlParPhoto)).forEach(function(k){ids[k]=1});
  var best=Object.keys(ids).map(function(n){var f=favUniques[n]||0,d=dlParPhoto[n]||0;return {p:parId(+n),f:f,d:d,score:f*3+d*2}}).filter(function(x){return x.p}).sort(function(a,b){return b.score-a.score}).slice(0,8);
  var blocBest='<div class="bloc" id="act-best"><div class="bloc-tete"><h2>Vos meilleures photos selon vos clients</h2>'+(best.length?'<button class="btn clair" id="export-best">'+I.dupliquer+'Copier la sélection</button>':'')+'</div>'+
    '<p class="note">Classement par favoris et téléchargements. Idéal pour votre portfolio et vos réseaux.</p>'+
    (best.length?'<div class="best">'+best.map(function(x,i){return '<figure><span class="rang num">'+(i+1)+'</span><img loading="lazy" src="'+SRC(x.p.n,'mini')+'" alt=""><figcaption class="num">'+I.coeurPlein+x.f+' '+I.dl+x.d+'</figcaption></figure>'}).join('')+'</div>':'<p class="note">Pas encore assez d’activité pour établir un classement.</p>')+'</div>';

  /* 5. Visiteurs */
  var parEmail={};D.telechargements.forEach(function(x){var e=parEmail[x.email]=parEmail[x.email]||{hd:0,web:0};e[x.qualite==='hd'?'hd':'web']+=x.nb});
  // 10 premières lignes, puis « Voir plus » (10 de plus à chaque clic)
  var PAS=10;
  function lignesVis(n){return D.visiteurs.slice(0,n).map(function(v){var e=parEmail[v.email];return '<tr><td>'+esc(v.email)+'</td><td>'+(EVT()?'Visiteur':v.role==='couple'?'Couple':'Invité')+'</td><td class="n" data-l="Visites">'+v.visites+'</td><td data-l="Dernière visite">'+depuis(v.derniere)+'</td><td data-l="Téléchargé">'+(e?[e.hd?e.hd+' HD':'',e.web?e.web+' web':''].filter(Boolean).join(' · '):'—')+'</td></tr>'}).join('')}
  function boutonPlus(id,reste,n){var moins=n>PAS;return reste>0||moins?'<div class="voir-plus">'+(moins?'<button class="btn clair" id="'+id+'-moins">Afficher moins</button>':'')+(reste>0?'<button class="btn clair" id="'+id+'">Voir plus <small>('+reste+' restant'+(reste>1?'s':'')+')</small></button>':'')+'</div>':''}
  var visN=PAS;
  var blocVis='<div class="bloc" id="act-vis" style="grid-column:1/-1"><h2>Visiteurs</h2>'+(D.visiteurs.length?'<div class="tableau"><table class="t-cartes"><thead><tr><th>E-mail</th><th>Rôle</th><th style="text-align:right">Visites</th><th>Dernière visite</th><th>Téléchargé</th></tr></thead><tbody id="vis-lignes">'+
    lignesVis(visN)+'</tbody></table></div><div id="vis-plus">'+boutonPlus('vis-btn',D.visiteurs.length-visN,visN)+'</div>':'<p class="note">Personne n’a encore ouvert la galerie.</p>')+'</div>';

  /* 6. Détail des téléchargements : qui a téléchargé quoi */
  function quoiDl(x){
    if(x.portee==='photo'||x.photo_id){var ph=parId(x.photo_id);return {img:ph?SRC(ph.n,'mini'):'',txt:ph?esc(ph.nom):'Photo supprimée'}}
    var t=x.portee==='tout'?'Galerie complète':x.portee==='fav'?'Ses favoris':x.portee==='album'?(SEANCE?'Sa sélection':'Sa sélection album'):'Catégorie « '+esc(nomDossier(x.portee)||x.portee)+' »';
    return {img:'',txt:'<b>'+t+'</b> · '+x.nb+' photo'+(x.nb>1?'s':'')+' (ZIP)'};
  }
  var pers=[];D.telechargements.forEach(function(x){if(x.email&&pers.indexOf(x.email)<0)pers.push(x.email)});
  var roleDe={};D.visiteurs.forEach(function(v){roleDe[v.email]=v.role});
  var dlN=PAS,dlF='';
  function dlFiltres(f){return D.telechargements.filter(function(x){return !f||x.email===f})}
  function lignesDl(f,n){
    var l=dlFiltres(f).slice(0,n||PAS);
    if(!l.length)return '<tr><td colspan="4" class="note">Aucun téléchargement.</td></tr>';
    return l.map(function(x){var q=quoiDl(x),r=x.role||roleDe[x.email];
      return '<tr><td>'+esc(x.email||'—')+'<br><small class="note">'+(EVT()?'':r==='couple'?'Couple':r==='invite'?'Invité':'')+'</small></td>'+
        '<td><div class="dl-quoi">'+(q.img?'<img loading="lazy" src="'+q.img+'" alt="">':'<span class="dl-zip">'+I.dl+'</span>')+'<span>'+q.txt+'</span></div></td>'+
        '<td><span class="etat '+(x.qualite==='hd'?'ok':'cours')+'">'+(x.qualite==='hd'?'HD':'Web')+'</span></td>'+
        '<td>'+dateHeure(x.ts)+'</td></tr>'}).join('');
  }
  var blocDl='<div class="bloc" id="act-dl" style="grid-column:1/-1"><div class="bloc-tete"><h2>Téléchargements</h2>'+
    (pers.length>1?'<select id="dl-filtre" aria-label="Filtrer par personne"><option value="">Tout le monde ('+D.telechargements.length+')</option>'+pers.map(function(e){return '<option value="'+esc(e)+'">'+esc(e)+'</option>'}).join('')+'</select>':'')+'</div>'+
    (D.telechargements.length?'<div class="tableau"><table class="t-cartes t-dl"><thead><tr><th>Qui</th><th>Quoi</th><th>Qualité</th><th>Quand</th></tr></thead><tbody id="dl-lignes">'+lignesDl('',dlN)+'</tbody></table></div><div id="dl-plus">'+boutonPlus('dl-btn',D.telechargements.length-dlN,dlN)+'</div>':'<p class="note">Personne n’a encore téléchargé de photo.</p>')+'</div>';

  $('adm-main').innerHTML=
   '<div class="adm-main-tete"><h2>Activité</h2><div class="outils-adm"><span class="etat '+(jours<30?'alerte':'ok')+'">'+STATUTS[ADM.statut].nom+' · '+(jours>=0?'expire dans '+jours+' jours':'expirée')+'</span><button class="action" id="prolonger">Prolonger de 3 mois</button></div></div>'+
   blocFil+
   '<div class="chiffres" id="act-chiffres">'+
     '<div class="chiffre"><b class="num">'+visites+'</b><span>visite'+(visites>1?'s':'')+' de la galerie</span></div>'+
     '<div class="chiffre"><b class="num">'+D.visiteurs.length+'</b><span>personne'+(D.visiteurs.length>1?'s':'')+' identifiée'+(D.visiteurs.length>1?'s':'')+'</span></div>'+
     '<div class="chiffre"><b class="num">'+hdDl+'</b><span>photos téléchargées en HD</span></div>'+
     '<div class="chiffre"><b class="num">'+Object.keys(favUniques).length+'</b><span>photos en favoris</span></div>'+
   '</div>'+
   '<div class="grille-admin">'+blocSauvegarde+(EVT()?'':blocAlbum)+blocBest+blocVis+blocDl+'</div>';
  function majDl(replie){$('dl-lignes').innerHTML=lignesDl(dlF,dlN);$('dl-plus').innerHTML=boutonPlus('dl-btn',dlFiltres(dlF).length-dlN,dlN);lierDl();if(replie)$('act-dl').scrollIntoView({block:'start',behavior:'smooth'})}
  function majVis(replie){$('vis-lignes').innerHTML=lignesVis(visN);$('vis-plus').innerHTML=boutonPlus('vis-btn',D.visiteurs.length-visN,visN);lierVis();if(replie)$('act-vis').scrollIntoView({block:'start',behavior:'smooth'})}
  function lierDl(){if($('dl-btn'))$('dl-btn').onclick=function(){dlN+=PAS;majDl()};if($('dl-btn-moins'))$('dl-btn-moins').onclick=function(){dlN=PAS;majDl(true)}}
  function lierVis(){if($('vis-btn'))$('vis-btn').onclick=function(){visN+=PAS;majVis()};if($('vis-btn-moins'))$('vis-btn-moins').onclick=function(){visN=PAS;majVis(true)}}
  if($('dl-filtre'))$('dl-filtre').onchange=function(){dlF=this.value;dlN=PAS;majDl()};
  if($('dl-plus'))lierDl();if($('vis-plus'))lierVis();

  $('prolonger').onclick=function(){var d=new Date((ADM.expiration||new Date().toISOString().slice(0,10))+'T12:00:00');if(d<new Date())d=new Date();d.setMonth(d.getMonth()+3);ADM.expiration=d.toISOString().slice(0,10);if(ADM.statut==='archivee')ADM.statut='publiee';sauverAdm(true);rendreAdmin();toast('Galerie prolongée jusqu’au '+dateFr(ADM.expiration)+'.')};
  var aa=$('activer-album');if(aa)aa.onclick=function(){ADM.albumActif=true;sauverAdm(true);rendreActivite();toast('Album activé : le couple peut maintenant choisir ses photos.')};
  var rs=$('relance-sauvegarde');if(rs)rs.onclick=function(){envoyerSimple('Pensez à télécharger vos photos',salutAdm()+'\n\nPetit rappel : pensez à télécharger vos photos en haute définition pour les garder précieusement. Votre galerie reste en ligne jusqu’au '+dateFr(ADM.expiration)+'.\n\nCode d’accès : '+ADM.code+'\n\nMélissa','Rappel de téléchargement envoyé.')};
  var ra=$('relance-album');if(ra)ra.onclick=function(){fenetreRelance([collCourante()])};
  var rz=$('reinit-sel');if(rz)rz.onclick=function(){
    var nn=Object.keys(etat.notes||{}).length;
    fenetre('<h2>Réinitialiser la sélection ?</h2><p>Les '+na+' photo'+(na>1?'s':'')+' choisie'+(na>1?'s':'')+(nn?' et les '+nn+' note'+(nn>1?'s':'')+' du client':'')+' seront retirées. '+(etat.verrou?'La sélection sera aussi rouverte : le client':'Le client')+' repartira de zéro, avec les mêmes photos dans sa galerie.</p>'+
      '<label class="option"><span class="g"><input type="checkbox" id="reinit-ok-case"><span>Je comprends que la sélection actuelle sera effacée</span></span></label>'+
      '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn danger" id="reinit-ok" disabled>Réinitialiser</button></div>');
    $('reinit-ok-case').onchange=function(){$('reinit-ok').disabled=!this.checked};
    $('reinit-ok').onclick=function(){this.disabled=true;api('collections/'+CID+'/reinitialiser',{method:'POST',body:{}}).then(function(){fermerFenetre();toast('Sélection réinitialisée : le client repart de zéro.');return recharger()}).catch(function(e){toast(e.message)})};
  };
  var ro=$('rouvrir-sel');if(ro)ro.onclick=function(){api('collections/'+CID+'/rouvrir',{method:'POST',body:{}}).then(function(){toast('Sélection rouverte : le client peut à nouveau la modifier.');return recharger()}).catch(function(e){toast(e.message)})};
  var ex=$('export-lr');if(ex)ex.onclick=function(){copier(selection().map(function(p){return p.nom.replace(/\.[^.]+$/,'')}).join(', '),'Liste copiée : '+etat.album.length+' noms de fichiers.')};
  var eb=$('export-best');if(eb)eb.onclick=function(){copier(best.map(function(x){return x.p.nom.replace(/\.[^.]+$/,'')}).join(', '),'Sélection copiée : '+best.length+' noms de fichiers, à coller dans Lightroom.')};
}

/* ---- Onglet Réglages ---- */
function rendreReglages(){
  $('adm-side').innerHTML='<div class="sets-tete"><span class="etiquette">Réglages</span></div><ul class="sets">'+
    [['reg-general','Général'],['reg-acces','Accès'],['reg-dl','Téléchargements'],['reg-album',SEANCE?'Sélection':'Album'],['reg-exp','Expiration']].filter(function(s){return !(EVT()&&s[0]==='reg-album')}).map(function(s){return '<li class="set" tabindex="0" data-cible="'+s[0]+'"><span class="set-nom">'+s[1]+'</span></li>'}).join('')+'</ul>';
  $('adm-side').querySelectorAll('[data-cible]').forEach(function(li){li.onclick=function(){var c=$(li.dataset.cible);if(c)c.scrollIntoView({behavior:'smooth',block:'start'})}});
  function bascule(id,txt,on,sous){return '<label class="reg-ligne interrupteur"><span>'+txt+(sous?'<small>'+sous+'</small>':'')+'</span><input type="checkbox" id="'+id+'"'+(on?' checked':'')+'><i></i></label>'}
  $('adm-main').innerHTML='<div class="adm-main-tete"><h2>Réglages</h2></div><div class="reglages">'+
    '<section class="bloc reg-large" id="reg-general"><h2>Général</h2><div class="champ"><label for="r-slug">Adresse de la collection</label>'+
      '<div class="url-champ"><span>'+DOMAINE+'</span><input type="text" id="r-slug" value="'+esc(ADM.slug)+'" spellcheck="false" autocomplete="off"></div>'+
      '<p class="note">Choisissez une adresse unique pour que vos clients accèdent à la collection. Lettres, chiffres et tirets uniquement.</p>'+
      '<p class="note" id="r-slug-apercu"></p></div>'+
      '<div class="champ"><label for="r-date">'+(SEANCE?'Date de la séance':EVT()?'Date de l’événement':'Date du mariage')+'</label><input type="date" id="r-date" value="'+esc(ADM.dateEvt||'')+'"><p class="note">Affichée sur la page d’accès et en couverture de la galerie client.</p></div>'+bascule('r-mur','Aperçu animé sur la page d’accès',ADM.mur!==false,'Les photos défilent en petit, floutées, derrière le formulaire de connexion.')+'</section>'+
    '<section class="bloc" id="reg-acces"><h2>Accès</h2>'+bascule('r-avec-code','Protéger la galerie par un code',!ADM.sansCode,'Désactivé : le lien suffit, seul l’e-mail du visiteur est demandé et tout le monde a le même accès.')+'<div id="r-codes">'+
      (EVT()?'<div class="champ"><label for="r-code">Code d’accès unique</label><input type="text" id="r-code" value="'+esc(ADM.code)+'"><p class="note">Le même code pour tout le monde : organisateurs, équipes, partenaires et participants.</p></div><input type="hidden" id="r-invite" value="'+esc(ADM.code)+'">':
      '<div class="champ"><label for="r-code">Code couple</label><input type="text" id="r-code" value="'+esc(ADM.code)+'"><p class="note">Accès complet : HD, favoris, sélection d’album.</p></div>'+
      '<div class="champ"><label for="r-invite">Code invités</label><input type="text" id="r-invite" value="'+esc(ADM.codeInvite)+'"><p class="note">Pour la famille et les amis : photos visibles, téléchargement selon les réglages ci-contre. Pas de favoris ni de sélection d’album.</p></div>')+'</div></section>'+
    '<section class="bloc" id="reg-dl"><h2>Téléchargements</h2>'+(EVT()?bascule('r-hd','Haute définition',ADM.hd,'Fichiers originaux, pour les impressions et les supports de communication.')+'<input type="checkbox" id="r-hdi" hidden>':'<p class="etiquette reg-sous">Couple</p>'+bascule('r-hd','Haute définition',ADM.hd,'Fichiers originaux, pour les tirages et l’album.')+'<p class="etiquette reg-sous">Invités</p>'+bascule('r-hdi','Haute définition',ADM.hdInvite,'Les invités peuvent aussi récupérer les fichiers originaux.'))+bascule('r-web','Taille web',ADM.web!==false,'Version 2048 px pour les réseaux et les messages.')+'</section>'+
    (SEANCE?'<section class="bloc" id="reg-album"><h2>Sélection du client</h2><input type="checkbox" id="r-album" checked hidden>'+'<div class="champ" id="r-quota-champ"><label for="r-quota">Photos retouchées incluses dans la formule</label><input type="number" id="r-quota" min="1" max="500" value="'+ADM.quota+'"></div>'+bascule('r-supp','Photos supplémentaires',ADM.supp!==false,'Le client peut en choisir au-delà de sa formule.')+'<div class="champ" id="r-prix-champ"><label for="r-prix">Prix par photo supplémentaire (€)</label><input type="number" id="r-prix" min="0" max="500" value="'+(ADM.prixSupp||0)+'"></div>'+reglageRelanceHTML()+'</section>':'<section class="bloc" id="reg-album"'+(EVT()?' hidden':'')+'><h2>Album</h2>'+bascule('r-album','Sélection de photos pour l’album',ADM.albumActif!==false,'Le couple choisit ses photos et valide sa sélection. Désactivez-la si le client n’a pas pris l’option album.')+
      '<div class="champ" id="r-quota-champ"><label for="r-quota">Nombre de photos à choisir</label><input type="number" id="r-quota" min="1" max="500" value="'+ADM.quota+'"></div>'+reglageRelanceHTML()+'</section>')+
    '<section class="bloc" id="reg-exp"><h2>Expiration</h2><div class="champ"><label for="r-exp">Galerie en ligne jusqu’au</label><input type="date" id="r-exp" value="'+ADM.expiration+'"></div>'+bascule('r-rappel',EVT()?'Rappel par e-mail 30 et 7 jours avant':'Rappel au couple 30 et 7 jours avant',ADM.rappel)+'</section>'+
    '</div><div class="ligne-btn" style="justify-content:flex-start;margin-top:16px"><button class="btn" id="r-ok">Enregistrer les réglages</button></div>';
  function majSlug(){var v=slugifier($('r-slug').value)||'…';$('r-slug-apercu').innerHTML='Lien complet : <b>https://'+DOMAINE+esc(v)+'</b>'+(v!==ADM.slug?' · l’ancien lien redirigera automatiquement vers celui-ci.':'')}
  $('r-slug').oninput=majSlug;$('r-slug').onblur=function(){var v=slugifier(this.value);if(v)this.value=v;majSlug()};majSlug();
  function majAlbumReg(e){var on=$('r-album').checked;$('r-quota').disabled=!on;$('r-quota-champ').style.opacity=on?1:.45;
    // Sans album, rien à relancer : la relance automatique se coupe avec l'album (et revient quand on le réactive)
    var r=$('r-relance');if(r){if(!on)r.checked=false;else if(e)r.checked=true;r.disabled=!on;r.closest('label').style.opacity=on?1:.45;majRel()}}
  $('r-album').onchange=majAlbumReg;majAlbumReg();
  function majRel(){$('r-relj').disabled=!$('r-relance').checked;$('r-relj-champ').style.opacity=$('r-relance').checked?1:.45}$('r-relance').onchange=majRel;majRel();
  function majAvecCode(){var on=$('r-avec-code').checked;$('r-codes').hidden=!on}$('r-avec-code').onchange=majAvecCode;majAvecCode();
  $('r-ok').onclick=function(){
    var sansCode=!$('r-avec-code').checked;
    var c=$('r-code').value.trim(),ci=EVT()?c:$('r-invite').value.trim(),q=parseInt($('r-quota').value,10);
    if(!sansCode&&EVT()&&!c){toast('Le code d’accès doit être rempli.');return}
    if(!sansCode&&!EVT()&&(!c||!ci)){toast('Les deux codes doivent être remplis.');return}
    if(!sansCode&&!EVT()&&c===ci){toast('Le code invités doit être différent du code couple.');return}
    ADM.sansCode=sansCode;if(sansCode){c=c||ADM.code;ci=ci||ADM.codeInvite}
    var sl=slugifier($('r-slug').value);if(!sl){toast('L’adresse de la collection ne peut pas être vide.');return}
    var ancien=ADM.slug;
    ADM.code=c;ADM.codeInvite=ci;ADM.hd=$('r-hd').checked;ADM.hdInvite=$('r-hdi').checked;ADM.web=$('r-web').checked;ADM.quota=q>0?q:60;ADM.albumActif=$('r-album').checked;ADM.expiration=$('r-exp').value||ADM.expiration;ADM.rappel=$('r-rappel').checked;ADM.dateEvt=$('r-date').value||ADM.dateEvt;ADM.mur=$('r-mur').checked;ADM.relanceAuto=$('r-relance').checked;ADM.relanceJours=Math.max(1,Math.min(90,parseInt($('r-relj').value,10)||14));if(SEANCE){ADM.supp=$('r-supp').checked;ADM.prixSupp=Math.max(0,+$('r-prix').value||0)}
    QUOTA=ADM.quota;var b=this;b.disabled=true;
    clearTimeout(minuteurSauve);
    var corps={slug:sl};CHAMPS.forEach(function(k){if(k in ADM)corps[k]=k==='dossiers'?ADM.dossiers.map(function(d){return {id:d.id,nom:d.nom,desc:d.desc||''}}):ADM[k]});
    api('collections/'+CID,{method:'PATCH',body:corps}).then(function(r){
      ADM.slug=r.slug;$('r-slug').value=r.slug;majSlug();genererMur();
      toast(ancien!==r.slug?'Réglages enregistrés. Nouvelle adresse : '+DOMAINE+r.slug:'Réglages enregistrés.');
    }).catch(function(e){toast(e.message)}).then(function(){b.disabled=false});
  };
}

/* ---------- Séances couple, famille, maternité : sélection filigranée ---------- */
function prix(k){return (k*(ADM.prixSupp||0))+' €'}
function nbSupp(){return Math.max(0,etat.album.length-QUOTA)}
function selection(){return etat.album.map(parId).filter(Boolean)}
function nbNotes(){return selection().filter(function(p){return etat.notes[p.id]}).length}
function majBandeau(){
  var b=$('bandeau-seance');if(!b)return;
  if(!SEANCE||etat.invite){b.hidden=true;return}
  var n=etat.album.length,h;
  if(LIVRE())h=I.check+'<div><b>Vos '+PHOTOS.length+' photos retouchées sont prêtes</b><p>Téléchargez-les en haute définition avec l’icône de téléchargement, ou une par une. Elles restent disponibles jusqu’au '+dateFr(ADM.expiration)+'.</p></div>';
  else if(etat.verrou)h=I.crayon+'<div><b>Sélection envoyée, merci !</b><p>Mélissa retouche vos '+n+' photo'+(n>1?'s':'')+'. Vous recevrez un e-mail dès qu’elles seront prêtes, ici même, avec le même lien et le même code.</p></div>';
  else h=I.album+'<div><b>Choisissez les photos à retoucher</b><p>Votre formule comprend '+QUOTA+' photos retouchées. Touchez le rond sur une photo pour la sélectionner'+(ADM.supp!==false?' ; au-delà, chaque photo supplémentaire est à '+ADM.prixSupp+' €':'')+'. Ces aperçus sont filigranés : vous recevrez les photos finales en haute définition, sans filigrane.</p></div>';
  b.innerHTML=h;b.hidden=false;
}
function validerSeance(){
  var n=etat.album.length,k=nbSupp(),reste=QUOTA-n,nn=nbNotes();
  fenetre('<h2>Envoyer ma sélection ?</h2><p>Vous avez choisi <b class="num">'+n+'</b> photo'+(n>1?'s':'')+'. '+
    (k?'Votre formule en comprend '+QUOTA+' : '+(k>1?'les <b>'+k+'</b> photos':'la photo')+' en plus '+(k>1?'sont facturées':'est facturée')+' '+ADM.prixSupp+' € pièce, soit <b>'+prix(k)+'</b>.'
      :reste>0?'Votre formule en comprend '+QUOTA+' : vous pouvez encore en choisir '+reste+' sans supplément.':'C’est exactement le nombre compris dans votre formule.')+
    (nn?' Vous avez laissé '+nn+' note'+(nn>1?'s':'')+' pour Mélissa.':'')+
    '</p><p>Une fois envoyée, la sélection est verrouillée et Mélissa commence la retouche. Vous recevrez un e-mail dès que vos photos seront prêtes, sur ce même lien.</p>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Continuer à choisir</button><button class="btn" id="ok-valider">Envoyer ma sélection</button></div>');
  $('ok-valider').onclick=function(){
    if(APERCU){fermerFenetre();toast('Aperçu : rien n’est envoyé.');return}
    var b=this;b.disabled=true;
    api('valider',{method:'POST',body:{}}).then(function(){
      etat.verrou=true;fermerFenetre();etat.vue='album';rendre();document.querySelector('.barre').scrollIntoView();
      toast('Merci ! Mélissa a bien reçu votre sélection.');
    }).catch(function(e){b.disabled=false;toast(e.message)});
  };
}
function fenetreNote(id){
  var p=parId(id),v=etat.notes[id]||'',ro=etat.verrou;
  fenetre('<h2>'+(ro?'Votre note pour Mélissa':'Une demande pour cette photo ?')+'</h2><p>'+(ro?'Votre sélection est envoyée, la note ne peut plus être modifiée.':'Écrivez-moi ce que vous souhaitez, je le lirai avant de retoucher la photo.')+'</p>'+
    '<div class="champ"><label for="note-txt">Votre note · '+esc(p.nom.replace(/\.jpe?g$/i,''))+'</label><textarea id="note-txt" rows="4" maxlength="400" placeholder="Ex. : une petite tache sur ma robe, un bouton à atténuer…"'+(ro?' readonly':'')+'>'+esc(v)+'</textarea>'+
    (ro||estAlbum(id)?'':'<p class="note">La photo sera ajoutée à votre sélection.</p>')+'</div>'+
    '<div class="ligne-btn">'+(ro?'<button class="btn" data-ferme>Fermer</button>':(v?'<button class="btn clair" id="sup-note">Supprimer la note</button>':'<button class="btn clair" data-ferme>Annuler</button>')+'<button class="btn" id="ok-note">Enregistrer</button>')+'</div>');
  if(ro)return;
  $('note-txt').focus();
  function fin(t){
    if(APERCU){fermerFenetre();return}
    api('note',{method:'POST',body:{photoId:id,texte:t}}).then(function(r){
      etat.notes=r.etat.notes;etat.album=r.etat.album;
      fermerFenetre();var y=window.scrollY;rendre(true);window.scrollTo(0,y);if(!$('vision').hidden)majVision();
      toast(t?'Note enregistrée pour Mélissa.':'Note supprimée.');
    }).catch(function(e){toast(e.message)});
  }
  $('ok-note').onclick=function(){fin($('note-txt').value.trim())};
  if($('sup-note'))$('sup-note').onclick=function(){fin('')};
}

/* ---- Vue photographe : les trois étapes ---- */
function rendreEtapes(){
  var m=$('adm-main');if(!m||!SEANCE)return;
  var n=etat.album.length,k=nbSupp(),liv=LIVRE(),recue=etat.verrou&&!liv,et=liv?3:recue?2:1,nn=nbNotes();
  function e(i,tx){return '<span class="etape'+(i<et?' fait':i===et?' cours':'')+'"><i>'+(i<et?'✓':i)+'</i>'+tx+'</span>'}
  var h='<section class="etapes" id="etapes"><div class="etapes-fil">'+e(1,'Sélection du client')+'<span class="etapes-fleche">›</span>'+e(2,'Retouche')+'<span class="etapes-fleche">›</span>'+e(3,'Livraison')+'</div>';
  var nLiv=TOUTES.filter(function(p){return estAlbum(p.id)&&p.variantes&&p.variantes.hd}).length;
  if(liv)h+='<h3>Photos livrées</h3><p>'+nLiv+' photos retouchées en HD, sur le même lien'+(ADM.livre?', depuis le '+dateHeure(ADM.livre):'')+'. Fichiers renommés '+esc(prefixeFichiers())+'-01.jpg à -'+(nLiv<100?('0'+nLiv).slice(-2):nLiv)+'.jpg. Le client a reçu l’e-mail « Vos photos sont prêtes ». Les aperçus filigranés ont été supprimés.</p>'+
    '<div class="ligne-btn"><button class="btn clair" id="et-copier">'+I.lien+'Copier le lien</button>'+(nLiv<n?'<button class="btn clair" id="et-livrer">'+I.ajout+'Ajouter des photos retouchées</button>':'')+'</div>';
  else if(recue)h+='<h3>Sélection reçue : '+n+' photo'+(n>1?'s':'')+'</h3><p>'+(ADM.albumValide?'Envoyée le '+dateHeure(ADM.albumValide)+' · ':'')+Math.min(n,QUOTA)+' incluses'+(k?' + <b>'+k+' en supplément, soit '+prix(k)+' à facturer</b>':'')+(nn?' · '+nn+' note'+(nn>1?'s':'')+' du client':'')+'. Vous avez reçu un e-mail de notification.</p>'+
    '<div class="ligne-btn"><button class="btn" id="et-livrer">'+I.ajout+'Téléverser les photos retouchées</button><button class="btn clair" id="et-voir">Voir la sélection</button><button class="btn clair" id="et-lr">Copier pour Lightroom</button><button class="btn clair" id="et-csv">'+I.dl+'Copier le tableau</button><button class="txtbtn" id="et-rouvrir">Rouvrir la sélection</button></div>';
  else h+='<h3>'+(n?'Sélection en cours : '+n+' / '+QUOTA:'En attente du client')+'</h3><p>'+(n?'Le client a choisi '+n+' photo'+(n>1?'s':'')+(k?', dont '+k+' en supplément ('+prix(k)+')':'')+(ADM.albumMaj?' · dernière modification '+depuis(ADM.albumMaj):'')+'. ':'Le client n’a pas encore commencé. Envoyez-lui le lien avec le bouton Partager. ')+'Les aperçus sont filigranés, le téléchargement et le partage sont bloqués.</p>'+
    '<div class="ligne-btn"><button class="btn" id="et-import">'+I.ajout+'Importer des RAW</button>'+(n?'<button class="btn clair" id="et-voir">Voir la sélection</button>':'')+'<button class="btn clair" id="et-relancer">'+I.mail+'Relancer le client</button>'+'<button class="btn clair" id="et-copier">'+I.lien+'Copier le lien</button></div>';
  m.insertAdjacentHTML('afterbegin',h+'</section>');
  function lier(id,f){var b=$(id);if(b)b.onclick=f}
  lier('et-copier',function(){copier(lienGalerie(),'Lien copié.')});
  lier('et-import',fenetreImport);
  lier('et-relancer',function(){fenetreRelance([collCourante()])});
  lier('et-voir',fenetreSelectionAdm);
  lier('et-lr',function(){copier(selection().map(function(p){return p.nom.replace(/\.[^.]+$/,'')}).join(', '),'Liste copiée : '+n+' noms de fichiers. Dans Lightroom : Filtre de bibliothèque › Texte › Nom de fichier › Contient, puis collez.')});
  lier('et-csv',exporterCSV);
  lier('et-livrer',fenetreLivrer);
  lier('et-rouvrir',function(){api('collections/'+CID+'/rouvrir',{method:'POST',body:{}}).then(function(){toast('Sélection rouverte : le client peut à nouveau la modifier.');return recharger()}).catch(function(e){toast(e.message)})});
}
function fenetreSelectionAdm(){
  var l=selection(),k=nbSupp();
  fenetre(enteteFen('Sélection du client')+'<p>'+l.length+' photo'+(l.length>1?'s':'')+(k?' · '+QUOTA+' incluses + '+k+' en supplément ('+prix(k)+')':'')+'. Les photos au-delà de la formule sont marquées, dans l’ordre où le client les a choisies.</p>'+
    '<div class="sel-liste">'+l.map(function(p,i){return '<div class="sel-ligne"><img src="'+SRC(p.n)+'" alt=""><div><b>'+esc(p.nom.replace('.jpg',''))+'</b>'+(etat.notes[p.id]?'<small>« '+esc(etat.notes[p.id])+' »</small>':'')+'</div>'+(i>=QUOTA?'<span class="tag-supp">+'+ADM.prixSupp+' €</span>':'<span></span>')+'</div>'}).join('')+'</div>'+
    '<div class="ligne-btn"><button class="btn clair" id="sa-csv">'+I.dl+'Copier le tableau</button><button class="btn" id="sa-lr">Copier pour Lightroom</button></div>');
  $('fenetre').classList.add('large-fen');
  $('sa-csv').onclick=exporterCSV;
  $('sa-lr').onclick=function(){copier(l.map(function(p){return p.nom.replace('.jpg','')}).join(', '),'Liste copiée. Dans Lightroom : Filtre de bibliothèque › Texte › Nom de fichier › Contient, puis collez.')};
}
function exporterCSV(){
  var l=selection();
  var tab='Fichier\tNote du client\tSupplément\n'+l.map(function(p,i){return [p.nom.replace('.jpg',''),(etat.notes[p.id]||'').replace(/\s+/g,' '),i>=QUOTA?ADM.prixSupp+' €':''].join('\t')}).join('\n');
  copier(tab,'Tableau copié ('+l.length+' photos) : collez-le dans Excel, Numbers ou Google Sheets.');
}
function lierDepot(dep,inp,f){
  ['dragenter','dragover'].forEach(function(ev){dep.addEventListener(ev,function(e){e.preventDefault();dep.classList.add('survol')})});
  ['dragleave','drop'].forEach(function(ev){dep.addEventListener(ev,function(e){e.preventDefault();dep.classList.remove('survol')})});
  dep.addEventListener('drop',function(e){f([].slice.call(e.dataTransfer.files))});
  inp.onchange=function(){f([].slice.call(inp.files));inp.value=''};
}
function baseNom(s){return s.replace(/\.[^.]+$/,'').toUpperCase().replace(/[-_ ](MODIFIER|EDIT|EDITED|RETOUCHE|FINAL|HD|\d{1,2})$/,'').replace(/\s*\(\d+\)$/,'')}
// Dernière étape de la livraison d'une séance : choisir et cadrer la couverture parmi les photos retouchées, puis envoyer l'e-mail
function etapeCouvLivraison(pf){
  var retouchees=selection().filter(function(p){return (VARS[p.id]||{}).web&&(VARS[p.id]||{}).hd}).map(function(p){return parId(p.id)||p});
  if(!retouchees.length){toast('Aucune photo retouchée en ligne.');return}
  fenetreCouv({liste:retouchees,titre:'Dernière étape : la couverture',libelle:I.envoyer+'Livrer au client',
    texte:'Choisissez la photo retouchée qui s’affichera en grand à l’ouverture de la galerie et dans l’e-mail, puis touchez l’aperçu pour ajuster le cadrage. L’e-mail « Vos photos sont prêtes » part quand vous cliquez sur « Livrer au client ».',
    valider:function(choix,pos,b){
      b.disabled=true;b.textContent='Livraison en cours…';
      ADM.couv=choix;ADM.couvPos=pos;
      sauverAdm(true).then(function(){return genererBanniere({net:true})}).then(function(){return api('collections/'+CID+'/livrer',{method:'POST',body:{prefixe:pf&&pf!==prefixeDefaut()?pf:null}})}).then(function(x){
        fermerFenetre();
        toast('Photos livrées ('+x.nb+')'+(x.statut==='envoyé'?' : le client a reçu l’e-mail « Vos photos sont prêtes ».':x.statut==='aucun destinataire'?'. Aucune adresse client : envoyez le lien avec Partager.':'.'));
        return recharger().then(function(){genererMur()});
      }).catch(function(e){b.disabled=false;b.innerHTML=I.envoyer+'Livrer au client';toast(e.message)});
    }});
}
function fenetreLivrer(){
  var l=selection(),attendus={},deja=LIVRE();l.forEach(function(p){attendus[baseNom(p.nom)]=p});
  var dejaEnvoyes=l.filter(function(p){return p.variantes&&p.variantes.hd}).length;
  fenetre(enteteFen(deja?'Ajouter des photos retouchées':'Téléverser les photos retouchées')+
    '<p>Exportez vos photos retouchées depuis Lightroom en gardant le nom de fichier d’origine (DSC_…), puis déposez-les ici. Chaque fichier est rapproché de la sélection du client.'+(dejaEnvoyes?' '+dejaEnvoyes+' sont déjà en ligne.':'')+'</p>'+
    '<label class="depot" id="liv-depot"><input type="file" id="liv-input" multiple accept="image/jpeg,.jpg,.jpeg" hidden><b>Glissez vos JPEG retouchés ici</b>ou cliquez pour les choisir</label>'+
    '<div class="liv-bilan" id="liv-bilan"></div>'+blocProgression()+
    (deja?'':'<div class="champ"><label for="liv-prefixe">Nom des fichiers livrés au client</label><input type="text" id="liv-prefixe" value="'+esc(prefixeFichiers())+'" spellcheck="false"><p class="note" id="liv-ex"></p></div>')+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="liv-ok" disabled>'+(deja?I.envoyer+'Envoyer':'Téléverser et continuer')+'</button></div>');
  $('fenetre').classList.add('large-fen');
  var trouves={};
  function bilan(extra){
    var nb=Object.keys(trouves).length,manq=l.filter(function(p){return !trouves[baseNom(p.nom)]&&!(p.variantes&&p.variantes.hd)});
    if(!nb&&dejaEnvoyes&&!deja){$('liv-bilan').innerHTML='<span class="ok">'+dejaEnvoyes+' photo'+(dejaEnvoyes>1?'s retouchées sont':' retouchée est')+' déjà en ligne.'+(manq.length?' Ajoutez les manquantes ici ou continuez.':'')+' Cliquez sur « Continuer » pour choisir la couverture.</span>';$('liv-ok').disabled=false;$('liv-ok').innerHTML='Continuer';return}
    $('liv-bilan').innerHTML='<span class="'+(manq.length?'ko':'ok')+'">'+nb+' / '+(l.length-dejaEnvoyes)+' photos de la sélection reconnues</span>'+
      (manq.length&&nb?'<span class="note">Manquantes : '+manq.map(function(p){return p.nom.replace(/\.[^.]+$/,'')}).join(', ')+'</span>':'')+
      (extra&&extra.length?'<span class="note">Ignorés (hors sélection) : '+extra.map(esc).join(', ')+'</span>':'');
    $('liv-ok').disabled=!nb;
    if(!deja)$('liv-ok').innerHTML=manq.length&&nb?'Continuer quand même':'Téléverser et continuer';
  }
  lierDepot($('liv-depot'),$('liv-input'),function(fs){
    var extra=[];fs.forEach(function(f){var b=baseNom(f.name);if(attendus[b])trouves[b]=f;else extra.push(f.name)});bilan(extra);
  });
  if(dejaEnvoyes&&!deja)bilan();
  if(!deja){
    var majEx=function(){var v=slugNom($('liv-prefixe').value)||prefixeDefaut(),w=l.length<100?2:3,z=function(i){return ('00'+i).slice(-w)};$('liv-ex').textContent='Une fois reconnues, les photos sont renommées dans l’ordre de prise de vue : '+v+'-'+z(1)+'.jpg, '+v+'-'+z(2)+'.jpg … '+v+'-'+z(l.length)+'.jpg. Vos fichiers DSC restent la référence de votre côté.'};
    $('liv-prefixe').oninput=majEx;majEx();
  }
  $('liv-ok').onclick=function(){
    var b=this;b.disabled=true;$('liv-depot').style.pointerEvents='none';
    var fichiers=Object.keys(trouves).map(function(k){return trouves[k]});
    var pf=deja?null:slugNom($('liv-prefixe').value);
    fileEnvoi(fichiers,function(f){return envoyerUnePhoto(f,{final:true})},majProgression).then(function(r){
      if(r.erreurs.length){$('liv-bilan').innerHTML='<span class="err">'+r.erreurs.map(esc).join('<br>')+'</span>';b.disabled=false;b.textContent='Réessayer';return}
      if(deja){fermerFenetre();toast(r.fait+' photo'+(r.fait>1?'s':'')+' ajoutée'+(r.fait>1?'s':'')+'.');return recharger()}
      return recharger().then(function(){etapeCouvLivraison(pf)});
    }).catch(function(e){b.disabled=false;toast(e.message)});
  };
}

/* ---- Import des RAW : aperçu intégré extrait dans le navigateur, réduit et filigrané ---- */
function orientationTiff(b){
  try{var le=b[0]===0x49&&b[1]===0x49;if(!le&&!(b[0]===0x4D&&b[1]===0x4D))return 1;
    var u16=function(o){return le?b[o]|b[o+1]<<8:b[o]<<8|b[o+1]},u32=function(o){return (le?(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24):(b[o]<<24|b[o+1]<<16|b[o+2]<<8|b[o+3]))>>>0};
    var ifd=u32(4),n=u16(ifd);for(var i=0;i<n;i++){var e=ifd+2+i*12;if(u16(e)===0x0112)return u16(e+8)}}catch(e){}
  return 1;
}
var tuileFil=null;
function preparerFiligrane(){
  if(tuileFil)return Promise.resolve(tuileFil);
  var svg=LOGO_SVG.replace(/currentColor/g,'#ffffff').replace('class="logo" aria-hidden="true" ','');
  var img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  return Promise.all([img.decode?img.decode():new Promise(function(r){img.onload=r}),document.fonts?document.fonts.load('600 30px "Hanken Grotesk"'):null]).then(function(){
    var lw=150,lh=Math.round(150*img.naturalHeight/img.naturalWidth),txt='MÉLISSA SIMÉON';
    var c=document.createElement('canvas'),x=c.getContext('2d');x.font='600 30px "Hanken Grotesk", sans-serif';
    var tw=0;for(var i=0;i<txt.length;i++)tw+=x.measureText(txt[i]).width+(i?6:0);
    c.width=Math.ceil(Math.max(tw,lw))+20;c.height=lh+60;
    x=c.getContext('2d');x.drawImage(img,(c.width-lw)/2,0,lw,lh);x.font='600 30px "Hanken Grotesk", sans-serif';x.fillStyle='#fff';x.textBaseline='top';
    var px=(c.width-tw)/2;for(var j=0;j<txt.length;j++){x.fillText(txt[j],px,lh+16);px+=x.measureText(txt[j]).width+6}
    tuileFil=c;return c;
  });
}
function apposerFiligrane(x,W,H,t){
  var sx=465,sy=352,a=-28*Math.PI/180;
  x.save();x.globalAlpha=.42;x.shadowColor='rgba(40,30,20,.6)';x.shadowBlur=6;
  for(var j=0,y=0;y<H+sy;j++,y+=sy){for(var X=(j%2?sx/2:0);X<W+sx;X+=sx){x.save();x.translate(X,y);x.rotate(a);x.drawImage(t,-t.width/2,-t.height/2);x.restore()}}
  x.restore();
}
function extraireApercu(file){
  return file.slice(0,Math.min(file.size,1<<16)).arrayBuffer().then(function(debut){
    var d=new Uint8Array(debut);
    if(d[0]===0xFF&&d[1]===0xD8)return {cands:[0],ori:1};
    var ori=orientationTiff(d);
    return file.arrayBuffer().then(function(buf){
      var b=new Uint8Array(buf),c=[],ok={0xDB:1,0xE0:1,0xE1:1,0xC4:1,0xC0:1,0xDD:1,0xEE:1,0xFE:1};
      for(var i=2;i<b.length-4;i++){if(b[i]===0xFF&&b[i+1]===0xD8&&b[i+2]===0xFF&&ok[b[i+3]])c.push(i)}
      return {cands:c.slice(0,24),ori:ori};
    });
  }).then(function(r){
    var meilleur=null,p=Promise.resolve();
    r.cands.forEach(function(off){p=p.then(function(){return createImageBitmap(file.slice(off,file.size,'image/jpeg')).then(function(bm){
      if(!meilleur||bm.width*bm.height>meilleur.width*meilleur.height){if(meilleur&&meilleur.close)meilleur.close();meilleur=bm}else if(bm.close)bm.close();
    },function(){})})});
    return p.then(function(){return {bmp:meilleur,ori:r.ori}});
  });
}
function produireApercu(bmp,ori,t){
  var L=1600,s=Math.min(1,L/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*s),h=Math.round(bmp.height*s),rot=ori===6||ori===8;
  var c=document.createElement('canvas');c.width=rot?h:w;c.height=rot?w:h;var x=c.getContext('2d');
  x.save();if(ori===6){x.translate(c.width,0);x.rotate(Math.PI/2)}else if(ori===8){x.translate(0,c.height);x.rotate(-Math.PI/2)}else if(ori===3){x.translate(c.width,c.height);x.rotate(Math.PI)}
  x.imageSmoothingQuality='high';x.drawImage(bmp,0,0,w,h);x.restore();
  apposerFiligrane(x,c.width,c.height,t);
  return new Promise(function(r){c.toBlob(function(bl){r({blob:bl,w:c.width,h:c.height})},'image/jpeg',.7)});
}
function poidsTxt(o){return o>=1048576?(o/1048576).toFixed(1).replace('.',',')+' Mo':Math.round(o/1024)+' Ko'}
function fenetreImport(initiaux){
  fenetre(enteteFen('Importer des RAW')+
    '<p>Déposez vos fichiers RAW (NEF, RAF, CR3, ARW, DNG) ou des JPEG. L’aperçu intégré à chaque fichier est extrait ici même, dans votre navigateur, réduit à 1600 px et filigrané. Vos RAW ne quittent jamais votre ordinateur.</p>'+
    '<label class="depot" id="imp-depot"><input type="file" id="imp-input" multiple accept=".nef,.raf,.cr2,.cr3,.arw,.dng,.jpg,.jpeg,image/jpeg" hidden><b>Glissez vos RAW ici</b>ou cliquez pour les choisir</label>'+
    '<p class="note" id="imp-bilan" hidden></p><div class="imp-grand" id="imp-grand" hidden><img alt=""><button class="ibtn" type="button" aria-label="Fermer l’aperçu">'+I.fermer+'</button></div><div class="imp-grille" id="imp-grille"></div>'+
    '<p class="note">Chaque aperçu part directement dans la galerie (environ 200 Ko). Touchez-en un pour le voir en grand et vérifier le filigrane.</p>'+
    '<div class="ligne-btn"><button class="btn" data-ferme>Fermer</button></div>');
  $('fenetre').classList.add('large-fen');
  var total={n:0,avant:0,apres:0,t0:0};
  $('imp-grille').addEventListener('click',function(e){var a=e.target.closest('[data-grand]');if(!a)return;e.preventDefault();var g=$('imp-grand');g.querySelector('img').src=a.dataset.grand;g.hidden=false;g.scrollIntoView({block:'nearest'})});
  $('imp-grand').querySelector('button').onclick=function(){$('imp-grand').hidden=true};
  var surImport;
  lierDepot($('imp-depot'),$('imp-input'),surImport=function(fs){
    fs=fs.filter(function(f){return /\.(nef|nrw|raf|cr2|cr3|arw|dng|orf|rw2|jpe?g)$/i.test(f.name)});
    if(!fs.length){toast('Aucun fichier RAW ou JPEG reconnu.');return}
    if(!total.t0)total.t0=performance.now();
    var g=$('imp-grille'),p=preparerFiligrane(),dossier=(DOSSIERS[0]||{}).id;
    var existants={};TOUTES.forEach(function(x){existants[baseNom(x.nom)]=1});
    var aFaire={};fs.forEach(function(f){var b=baseNom(f.name);if(!existants[b])aFaire[b]=1});suiviAjouter('Import des RAW',Object.keys(aFaire).length);
    fs.forEach(function(f){
      if(existants[baseNom(f.name)]){var fx=document.createElement('figure');fx.innerHTML='<span class="ph-att"></span><span><b>'+esc(f.name)+'</b><br>Déjà importée</span>';g.appendChild(fx);return}
      existants[baseNom(f.name)]=1;
      var fig=document.createElement('figure');fig.innerHTML='<span class="ph-att"></span><span><b>'+esc(f.name)+'</b><br>'+poidsTxt(f.size)+' · en cours…</span>';g.appendChild(fig);
      p=p.then(function(t){return extraireApercu(f).then(function(r){
        if(!r.bmp){fig.lastChild.innerHTML='<b>'+esc(f.name)+'</b><br><span class="err">Aperçu introuvable dans ce fichier</span>';suiviPas(false);return t}
        return produireApercu(r.bmp,r.ori,t).then(function(o){
          if(r.bmp.close)r.bmp.close();
          return api('collections/'+CID+'/photos',{method:'POST',body:{dossier:dossier,nom:f.name.replace(/\.[^.]+$/,'')+'.jpg',w:o.w,h:o.h}}).then(function(fiche){return envoyerVariante(fiche.id,'apercu',o.blob)}).then(function(){return o});
        }).then(function(o){
          var u=URL.createObjectURL(o.blob);
          fig.innerHTML='<a href="#" data-grand="'+u+'"><img src="'+u+'" alt=""></a><span><b>'+esc(f.name.replace(/\.[^.]+$/,''))+'</b><br>'+poidsTxt(f.size)+' → '+poidsTxt(o.blob.size)+' · '+o.w+'×'+o.h+'</span>';
          total.n++;total.avant+=f.size;total.apres+=o.blob.size;suiviPas(true);
          if($('imp-bilan'))$('imp-bilan').hidden=false;if($('imp-bilan'))$('imp-bilan').textContent=total.n+' aperçu'+(total.n>1?'s':'')+' filigrané'+(total.n>1?'s':'')+' en '+Math.round((performance.now()-total.t0)/1000)+' s · '+poidsTxt(total.avant)+' de RAW → '+poidsTxt(total.apres)+' envoyés en ligne';
          return t;
        });
      })}).catch(function(e){suiviPas(false);fig.lastChild.innerHTML='<b>'+esc(f.name)+'</b><br><span class="err">'+esc(e&&e.message?e.message:'Fichier illisible')+'</span>';return tuileFil});
    });
    p.then(function(){return recharger()}).then(function(){genererMur()});
  });
  if(initiaux&&initiaux.length)surImport(initiaux);
}

/* ---------- Relances des sélections (album et séance) ---------- */
var J_MS=864e5;
function aRelancer(c){var a=alertesDe(c);return a.indexOf('album')>-1?'album':a.indexOf('selclient')>-1?'selclient':null}
function reglageRelance(c){return {auto:c.relanceAuto!==false,jours:c.relanceJours||14}}
function derniereRelance(c){return c.derniereRelance||null}
function prochaineRelance(c){
  var r=reglageRelance(c);if(!r.auto)return null;
  var base=derniereRelance(c)||c.publieLe||c.creeTs||Date.now(),t=base+r.jours*J_MS;
  while(t<Date.now())t+=J_MS;return t;
}
function txtAuto(l){var ps=l.map(prochaineRelance).filter(Boolean).sort(function(a,b){return a-b});return ps.length?'Prochaine relance auto le '+dateJour(ps[0]):'Relance auto désactivée'}
function dateJour(ts){return new Date(ts).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}
function prenomsDe(c){var n=c.nom.replace(/^(Mariage|Séance couple|Séance famille|Séance maternité|Séance)\s+/i,'');return /^Famille\s/i.test(n)?'à toute la famille '+n.replace(/^Famille\s+/i,''):n.replace(/\s*&\s*/,' et ')}
function avancementDe(c){return c.nsel===undefined?'':c.nsel+' / '+c.quota+' photos choisies'}
function texteRelance(c){
  var k=aRelancer(c),n=c.nsel||0,q=c.quota||(k==='album'?60:15),lien=location.protocol+'//'+DOMAINE+slugDe(c);
  var corps=k==='album'
    ?'Petit rappel : la sélection des photos pour votre album vous attend. '+(n?'Vous en avez déjà choisi '+n+' sur '+q+', plus que '+Math.max(0,q-n)+' !':'Vous pouvez en choisir '+q+', directement depuis votre galerie.')+' Dès que vous l’aurez validée, je commence la mise en page.'
    :'Petit rappel : vos photos vous attendent ! Choisissez celles que vous souhaitez recevoir retouchées : votre formule en comprend '+q+(n?' et vous en avez déjà sélectionné '+n:'')+'. Dès que vous aurez envoyé votre sélection, je commence la retouche.';
  return {objet:k==='album'?'Votre sélection pour l’album vous attend':'Vos photos attendent votre sélection',
    texte:'Bonjour '+prenomsDe(c)+',\n\n'+corps+'\n\nVotre galerie : '+lien+'\nCode d’accès : '+(c.code||'celui reçu dans mon premier e-mail')+'\n\nÀ très vite,\nMélissa'};
}
function fenetreRelance(liste){
  liste=liste.filter(aRelancer);
  if(!liste.length){toast('Aucune sélection en attente à relancer (la collection doit être publiée).');return}
  var seul=liste.length===1,choisis={};liste.forEach(function(c){choisis[c.id]=true});
  var lignes=liste.map(function(c){
    var d=derniereRelance(c),p=prochaineRelance(c),r=reglageRelance(c);
    return '<label class="rel-ligne"><input type="checkbox" data-rel="'+c.id+'" checked'+(seul?' hidden':'')+'><span><b>'+esc(c.nom)+'</b><small>'+(aRelancer(c)==='album'?'Album':'Séance')+(avancementDe(c)?' · '+avancementDe(c):'')+' · '+(d?'dernière relance '+depuis(d):'jamais relancé')+' · '+(r.auto?'relance auto le '+dateJour(p):'relance auto désactivée')+'</small></span></label>';
  }).join('');
  var m=texteRelance(liste[0]);
  fenetre(enteteFen(seul?'Relancer le client':'Relancer '+liste.length+' clients')+
    '<div class="rel-liste">'+lignes+'</div>'+
    '<div class="champ"><label for="rel-objet">Objet</label><input type="text" id="rel-objet" value="'+esc(m.objet)+'"'+(seul?'':' readonly')+'></div>'+
    '<div class="champ"><label for="rel-texte">Message'+(seul?'':' (aperçu pour '+esc(liste[0].nom)+')')+'</label><textarea id="rel-texte" rows="10"'+(seul?'':' readonly')+'>'+esc(m.texte)+'</textarea>'+
    (seul?'':'<p class="note">Chaque client reçoit ce message personnalisé : prénoms, avancement de sa sélection, lien et code de sa galerie.</p>')+'</div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="rel-ok">'+I.envoyer+'<span id="rel-ok-txt"></span></button></div>');
  $('fenetre').classList.add('large-fen');
  function maj(){var n=Object.keys(choisis).filter(function(k){return choisis[k]}).length;$('rel-ok-txt').textContent=seul?'Envoyer la relance':'Relancer '+n+' client'+(n>1?'s':'');$('rel-ok').disabled=!n}
  $('fenetre').querySelectorAll('[data-rel]').forEach(function(x){x.onchange=function(){choisis[x.dataset.rel]=x.checked;maj()}});maj();
  $('rel-ok').onclick=function(){
    var b=this;b.disabled=true;
    var faits=liste.filter(function(c){return choisis[c.id]}),erreurs=[];
    faits.reduce(function(pr,c){return pr.then(function(){
      return api('collections/'+c.id+'/relance',{method:'POST',body:seul?{objet:$('rel-objet').value,texte:$('rel-texte').value}:{}}).catch(function(e){erreurs.push(c.nom+' : '+e.message)});
    })},Promise.resolve()).then(function(){
      fermerFenetre();
      var ok=faits.length-erreurs.length;
      toast(erreurs.length?erreurs.join(' · '):(ok>1?'Relance envoyée à '+ok+' clients.':'Relance envoyée.'));
      return chargerCollections().then(function(){if(admPage==='collection')return recharger();rendreCollections()});
    });
  };
}
function reglageRelanceHTML(){
  return '<label class="reg-ligne interrupteur"><span>Relance automatique<small>Tant que la sélection n’est pas envoyée, un rappel part par e-mail à intervalle régulier.</small></span><input type="checkbox" id="r-relance"'+(ADM.relanceAuto!==false?' checked':'')+'><i></i></label>'+
    '<div class="champ" id="r-relj-champ"><label for="r-relj">Intervalle entre deux relances (jours)</label><input type="number" id="r-relj" min="1" max="90" value="'+(ADM.relanceJours||14)+'"></div>';
}

/* ---------- Demandes de devis et de réservation ---------- */
var DEMANDES=null,DEM={q:'',type:'',vue:'colonnes',mois:null};
function delaiRelance(){var n=parseInt(PREFS.relanceDevisJours,10);return n>0&&n<91?n:7}
// Dernier contact (devis ou relance) et nombre de jours sans réponse, pour un devis en attente
function attenteDemande(d){if(d.statut!=='devis'&&d.statut!=='relancee')return null;var rl=d.relances||[],der=Math.max(d.devisLe||0,rl.length?rl[rl.length-1]:0)||d.maj||d.recu;return Math.floor((Date.now()-der)/864e5)}
var ETAPES=[['nouvelle','Nouvelles','Pas encore traitées'],['devis','Devis envoyé','En attente de réponse'],['relancee','Relancées','Devis relancé'],['reservee','Réservées','Acompte reçu ou contrat signé'],['livree','Galerie livrée','Photos livrées'],['perdue','Sans suite','Pas de réponse ou refus']];
function chargerDemandes(){return api('demandes').then(function(l){DEMANDES=l||[];return DEMANDES})}
function nbNouvelles(){return (DEMANDES||[]).filter(function(d){return d.statut==='nouvelle'}).length}
function nomDemande(d){var n=(d.nom||'').trim();return d.conjoint&&n.indexOf(d.conjoint)<0?n+' & '+d.conjoint:n||d.email||'Sans nom'}
function dateDemande(d){return d.dateEvt?new Date(d.dateEvt+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):(d.dateTxt||'Date non précisée')}
// Une autre réservation (demande réservée ou galerie de mariage/séance) le même jour
function conflitDate(d){
  if(!d.dateEvt)return null;
  var a=(DEMANDES||[]).filter(function(x){return x.id!==d.id&&x.dateEvt===d.dateEvt&&(x.statut==='reservee'||x.statut==='livree')})[0];
  if(a)return nomDemande(a);
  var c=collections().filter(function(x){return x.date===d.dateEvt&&x.id!==d.collectionId&&x.classeur!=='Événements'})[0];
  return c?c.nom:null;
}
function filtrerDemandes(){
  var q=DEM.q.trim().toLowerCase();
  return (DEMANDES||[]).filter(function(d){
    if(DEM.type&&d.type!==DEM.type)return false;
    if(q&&(nomDemande(d)+' '+(d.email||'')+' '+(d.lieu||'')).toLowerCase().indexOf(q)<0)return false;
    return true;
  });
}
function carteDemande(d){
  var cf=conflitDate(d),coll=d.collectionId?collections().filter(function(c){return c.id===d.collectionId})[0]:null;
  return '<article class="dcarte'+(d.statut==='nouvelle'?' neuve':'')+'" data-dem="'+d.id+'" draggable="true" tabindex="0">'+
    '<div class="dc-haut"><span class="dc-type t-'+d.type+'">'+(d.type==='seance'?'Séance':'Mariage')+'</span><time title="Reçue le '+dateHeure(d.recu)+'">'+depuis(d.recu)+'</time></div>'+
    '<h3>'+esc(nomDemande(d))+'</h3>'+
    '<p class="dc-date">'+I.calendrier+esc(dateDemande(d))+'</p>'+
    (d.lieu?'<p class="dc-lieu">'+esc(d.lieu.replace(/(Préparatifs|Cérémonie|Réception)\s*:\s*/g,'').split(' / ').filter(Boolean).slice(0,2).join(' · '))+'</p>':'')+
    (d.devisMontant?'<p class="dc-devis">Devis : <b>'+esc(d.devisMontant)+'</b></p>':'')+
    (function(){var a=attenteDemande(d);return a!==null&&a>=delaiRelance()?'<p class="dc-attente">'+I.mail+'Sans réponse depuis '+a+' j'+((d.relances||[]).length?' · '+d.relances.length+' relance'+(d.relances.length>1?'s':''):'')+'</p>':''})()+
    (cf&&d.statut!=='perdue'&&d.statut!=='livree'&&d.statut!=='reservee'?'<p class="dc-alerte">'+I.historique+'Date déjà prise : '+esc(cf)+'</p>':'')+
    (coll?'<p class="dc-galerie">'+I.image+'Galerie : '+STATUTS[coll.statut].nom.toLowerCase()+'</p>':'')+
  '</article>';
}
function ouvrirDemandes(){
  admPage='demandes';CID=null;DONNEES=null;history.replaceState(null,'',location.pathname+'#demandes');
  return chargerDemandes().then(rendreDemandes).catch(function(e){toast(e.message)});
}
function rendreDemandes(){
  fermerPop();
  var l=filtrerDemandes(),tot=(DEMANDES||[]).length;
  var annee=String(new Date().getFullYear()),cetteAnnee=(DEMANDES||[]).filter(function(d){return new Date(d.recu).getFullYear()==annee});
  var res=cetteAnnee.filter(function(d){return d.statut==='reservee'||d.statut==='livree'}).length;
  $('admin').innerHTML='<div class="app'+(PREFS.replieApp?' replie':'')+'">'+asideApp('demandes')+
    '<main class="app-main">'+
      '<div class="coll-tete"><div class="coll-titre"><h1>Demandes</h1><label class="recherche">'+I.loupe+'<input type="search" id="dem-q" placeholder="Rechercher" value="'+esc(DEM.q)+'"></label></div>'+
        '<div class="adm-actions"><button class="btn sauge" id="dem-ajout">'+I.ajout+'Ajouter une demande</button></div></div>'+
      '<div class="dem-barre"><div class="puces">'+[['','Toutes'],['mariage','Mariages'],['seance','Séances']].map(function(t){return '<button class="puce-filtre'+(DEM.type===t[0]?' on':'')+'" data-dtype="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>'+
        '<div class="dem-outils"><div class="bascule-vue">'+[['colonnes','Colonnes'],['calendrier','Calendrier']].map(function(v){return '<button class="'+(DEM.vue===v[0]?'on':'')+'" data-dvue="'+v[0]+'">'+(v[0]==='colonnes'?I.liste:I.calendrier)+v[1]+'</button>'}).join('')+'</div><button class="lienbtn" id="dem-delai" title="Délai avant le rappel d’un devis sans réponse">'+I.historique+'Rappel après '+delaiRelance()+' j</button></div>'+
        '<p class="dem-chiffres">'+cetteAnnee.length+' demande'+(cetteAnnee.length>1?'s':'')+' en '+annee+' · '+res+' réservée'+(res>1?'s':'')+(cetteAnnee.length?' ('+Math.round(res/cetteAnnee.length*100)+' %)':'')+'</p></div>'+
      (tot&&DEM.vue==='calendrier'?calendrierDemandes(l):tot?'<div class="kanban">'+ETAPES.map(function(e){
        var c=l.filter(function(d){return d.statut===e[0]});
        return '<section class="kcol" data-etape="'+e[0]+'"><header><h2>'+e[1]+'</h2><span class="num">'+c.length+'</span></header><small>'+e[2]+'</small><div class="kliste">'+(c.length?c.map(carteDemande).join(''):'<p class="kvide">Glissez une demande ici</p>')+'</div></section>';
      }).join('')+'</div>'
      :'<div class="vide"><h3>Aucune demande pour l’instant</h3><span>Les demandes envoyées depuis votre formulaire de devis apparaîtront ici automatiquement. Vous pouvez aussi ajouter à la main une demande reçue sur Instagram ou WhatsApp.</span></div>')+
    '</main></div>';
  lierNav(rendreDemandes);rendreCompteur();
  var q=$('dem-q');q.oninput=function(){DEM.q=q.value;var pos=q.selectionStart;rendreDemandes();var n=$('dem-q');n.focus();n.setSelectionRange(pos,pos)};
  document.querySelectorAll('[data-dtype]').forEach(function(b){b.onclick=function(){DEM.type=b.dataset.dtype;rendreDemandes()}});
  document.querySelectorAll('[data-dvue]').forEach(function(b){b.onclick=function(){DEM.vue=b.dataset.dvue;rendreDemandes()}});
  $('dem-delai').onclick=function(e){e.stopPropagation();pop(this,'<div class="pop-label">Me rappeler un devis sans réponse après</div>'+[3,5,7,10,14,21].map(function(n){return itemPop(String(n),null,n+' jours',delaiRelance()===n)}).join('')+'<p class="pop-note">Un e-mail récapitulatif vous est envoyé chaque matin s’il y a des devis à relancer.</p>',function(m){
    m.querySelectorAll('[data-a]').forEach(function(b){b.onclick=function(){fermerPop();sauverPrefs({relanceDevisJours:+b.dataset.a});rendreDemandes();toast('Rappel après '+b.dataset.a+' jours sans réponse.')}})})};
  document.querySelectorAll('[data-cal-dem]').forEach(function(c){c.onclick=function(){fenetreDemande(c.dataset.calDem)}});
  document.querySelectorAll('[data-cal-coll]').forEach(function(c){c.onclick=function(){ouvrirCollection(c.dataset.calColl)}});
  document.querySelectorAll('[data-cal-mois]').forEach(function(b){b.onclick=function(){var m=b.dataset.calMois,d=DEM.mois||new Date();DEM.mois=m==='0'?null:new Date(d.getFullYear(),d.getMonth()+(+m),1);rendreDemandes()}});
  $('dem-ajout').onclick=fenetreAjoutDemande;
  document.querySelectorAll('[data-dem]').forEach(function(c){
    c.onclick=function(){fenetreDemande(c.dataset.dem)};
    c.onkeydown=function(e){if(e.key==='Enter')fenetreDemande(c.dataset.dem)};
    c.ondragstart=function(e){e.dataTransfer.setData('text/plain',c.dataset.dem);e.dataTransfer.effectAllowed='move';c.classList.add('glisse')};
    c.ondragend=function(){c.classList.remove('glisse')};
  });
  document.querySelectorAll('.kcol').forEach(function(col){
    col.ondragover=function(e){e.preventDefault();col.classList.add('survol')};
    col.ondragleave=function(e){if(!col.contains(e.relatedTarget))col.classList.remove('survol')};
    col.ondrop=function(e){e.preventDefault();col.classList.remove('survol');var id=e.dataTransfer.getData('text/plain');if(id)changerEtape(id,col.dataset.etape)};
  });
}
function majDemandeLocale(d){DEMANDES=(DEMANDES||[]).map(function(x){return x.id===d.id?d:x})}
function changerEtape(id,etape){
  var d=(DEMANDES||[]).filter(function(x){return x.id===id})[0];if(!d||d.statut===etape)return;
  d.statut=etape;rendreDemandes();
  api('demandes/'+id,{method:'PATCH',body:{statut:etape}}).then(function(n){majDemandeLocale(n);if(admPage==='demandes')rendreDemandes();toast('« '+nomDemande(n)+' » → '+ETAPES.filter(function(e){return e[0]===etape})[0][1]+'.')}).catch(function(e){toast(e.message);ouvrirDemandes()});
}
function fenetreDemande(id){
  var d=(DEMANDES||[]).filter(function(x){return x.id===id})[0];if(!d)return;
  var cf=conflitDate(d),coll=d.collectionId?collections().filter(function(c){return c.id===d.collectionId})[0]:null;
  var tel=(d.tel||'').replace(/[^\d+]/g,''),wa=tel.replace(/^\+/,'').replace(/^0(?=6|7)/,'596');
  var objet=d.type==='seance'?'Votre demande de séance photo':'Votre demande de devis mariage';
  fenetre(enteteFen(esc(nomDemande(d)))+
    '<p class="dem-sous"><span class="dc-type t-'+d.type+'">'+(d.type==='seance'?'Séance':'Mariage')+'</span> Reçue le '+dateHeure(d.recu)+(d.origine==='manuel'?' · ajoutée à la main':' · formulaire')+(d.source?' · '+esc(d.source):'')+'</p>'+
    (cf?'<div class="indic alerte">'+I.historique+'<div><b>Date déjà prise</b><span>Vous avez déjà « '+esc(cf)+' » le '+esc(dateDemande(d))+'.</span></div></div>':'')+
    '<div class="dem-grille">'+
      '<div class="champ"><label for="fd-etape">Étape</label><select id="fd-etape">'+ETAPES.map(function(e){return '<option value="'+e[0]+'"'+(e[0]===d.statut?' selected':'')+'>'+e[1]+'</option>'}).join('')+'</select></div>'+
      '<div class="champ"><label for="fd-date">Date '+(d.type==='seance'?'de la séance':'du mariage')+'</label><input type="date" id="fd-date" value="'+esc(d.dateEvt||'')+'">'+(!d.dateEvt&&d.dateTxt?'<p class="note">Indiquée : '+esc(d.dateTxt)+'</p>':'')+'</div>'+
      '<div class="champ"><label for="fd-montant">Montant du devis</label><input type="text" id="fd-montant" value="'+esc(d.devisMontant||'')+'" placeholder="Ex. : 1 450 €"><p class="note">'+(d.devisLe?'Devis envoyé le '+dateHeure(d.devisLe):'La date d’envoi se note toute seule quand la demande passe à « Devis envoyé ».')+'</p></div>'+
      '<div class="champ"><label>Contact</label><div class="dem-contact">'+
        (d.email?'<a href="mailto:'+esc(d.email)+'?subject='+encodeURIComponent(objet)+'">'+I.mail+esc(d.email)+'</a>':'')+
        (tel?'<a href="tel:'+esc(tel)+'">'+I.tel+esc(d.tel)+'</a><a href="https://wa.me/'+esc(wa)+'" target="_blank" rel="noopener">'+I.partage+'WhatsApp</a>':'')+
        (!d.email&&!tel?'<span class="note">Aucun contact renseigné</span>':'')+'</div></div>'+
    '</div>'+
    (d.relances&&d.relances.length?'<p class="note dem-relances">'+I.mail+'Relancé'+(d.relances.length>1?' '+d.relances.length+' fois':'')+' : '+d.relances.map(function(t){return dateHeure(t)}).join(', ')+'</p>':'')+
    '<div class="champ"><label for="fd-notes">Notes internes</label><textarea id="fd-notes" rows="3" placeholder="Visibles uniquement par vous : échanges, options proposées, relances…">'+esc(d.notes||'')+'</textarea></div>'+
    (d.champs&&d.champs.length?'<details class="dem-reponses" open><summary>Réponses '+(d.origine==='manuel'?'':'au formulaire')+' ('+d.champs.length+')</summary><dl>'+d.champs.map(function(c){return '<div><dt>'+esc(c.label)+'</dt><dd>'+esc(c.valeur).replace(/\n/g,'<br>')+'</dd></div>'}).join('')+'</dl></details>':'')+
    '<div class="ligne-btn dem-actions"><button class="txtbtn danger-txt" id="fd-suppr">Supprimer</button><span style="flex:1"></span>'+
      (d.email&&d.statut!=='reservee'&&d.statut!=='livree'&&d.statut!=='perdue'?'<button class="btn clair" id="fd-relance">'+I.mail+'Relancer par e-mail</button>':'')+
      (coll?'<button class="btn clair" id="fd-galerie">'+I.image+'Ouvrir la galerie</button>':'<button class="btn clair" id="fd-creer">'+I.ajout+'Créer la galerie</button>')+
      '<button class="btn" id="fd-ok">Enregistrer</button></div>');
  $('fenetre').classList.add('large-fen');
  function enregistrer(fermer){
    var b={statut:$('fd-etape').value,dateEvt:$('fd-date').value,devisMontant:$('fd-montant').value.trim(),notes:$('fd-notes').value};
    return api('demandes/'+id,{method:'PATCH',body:b}).then(function(n){majDemandeLocale(n);if(fermer){fermerFenetre();toast('Demande enregistrée.')}if(admPage==='demandes')rendreDemandes();else rendreCollections();return n}).catch(function(e){toast(e.message)});
  }
  $('fd-ok').onclick=function(){enregistrer(true)};
  $('fd-suppr').onclick=function(){
    fenetre('<h2>Supprimer cette demande ?</h2><p>La demande de « '+esc(nomDemande(d))+' » et vos notes seront effacées définitivement. La galerie éventuellement créée n’est pas touchée.</p><div class="ligne-btn"><button class="btn clair" id="fd-non">Annuler</button><button class="btn danger" id="fd-oui">Supprimer</button></div>');
    $('fd-non').onclick=function(){fenetreDemande(id)};
    $('fd-oui').onclick=function(){api('demandes/'+id,{method:'DELETE'}).then(function(){DEMANDES=DEMANDES.filter(function(x){return x.id!==id});fermerFenetre();rendreDemandes();toast('Demande supprimée.')}).catch(function(e){toast(e.message)})};
  };
  if($('fd-galerie'))$('fd-galerie').onclick=function(){fermerFenetre();ouvrirCollection(d.collectionId)};
  if($('fd-relance'))$('fd-relance').onclick=function(){enregistrer(false).then(function(n){if(n)fenetreRelanceDemande(n)})};
  if($('fd-creer'))$('fd-creer').onclick=function(){
    enregistrer(false).then(function(n){if(!n)return;fermerFenetre();
      var prenom=(n.prenom||(n.nom||'').split(/\s+/)[0]||'').trim();
      fenetreNouvelle(n.type==='seance'?'Séance photo':'Mariage',{
        nom:n.type==='seance'?'Séance '+(n.nom||prenom):'Mariage '+(n.conjoint?prenom+' & '+n.conjoint:(n.nom||prenom)),
        date:n.dateEvt||'',email:n.email||'',demande:n.id,
        album:(n.champs||[]).some(function(c){return /option/i.test(c.label)&&/album/i.test(c.valeur)})?'oui':null});
    });
  };
}
function texteRelanceDemande(d){
  var prenom=(d.prenom||(d.nom||'').split(/\s+/)[0]||'').trim(),noms=d.conjoint?prenom+' et '+d.conjoint:prenom;
  var seance=d.type==='seance',rl=(d.relances||[]).length;
  var quand=d.dateEvt?(seance?'de votre séance du ':'de votre mariage du ')+new Date(d.dateEvt+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):(seance?'de votre séance photo':'de votre mariage');
  var libre=d.dateEvt&&!conflitDate(d);
  var corps=d.devisLe?'Je me permets de revenir vers vous au sujet du devis que je vous ai envoyé le '+new Date(d.devisLe).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})+' pour les photos '+quand+'.':'Je reviens vers vous au sujet de votre demande pour les photos '+quand+'.';
  return {objet:seance?'Votre séance photo':'Votre devis photo pour votre mariage',
    texte:'Bonjour '+noms+',\n\n'+corps+'\n\n'+(rl?'Je voulais simplement m’assurer que mon précédent message vous était bien parvenu. ':'')+'Avez-vous eu le temps d’y jeter un œil ? Je reste disponible pour en parler, ajuster la proposition ou répondre à vos questions.'+(libre?'\n\nVotre date est encore libre dans mon agenda, mais je ne peux pas la bloquer sans confirmation de votre part.':'')+'\n\nBelle journée,\nMélissa'};
}
function fenetreRelanceDemande(d){
  var t=texteRelanceDemande(d);
  fenetre(enteteFen('Relancer '+esc(nomDemande(d)))+'<p class="note">Envoyé à <b>'+esc(d.email)+'</b> depuis galerie@melissa-simeon.com, avec votre mise en page. Les réponses arrivent sur votre Gmail.</p>'+
    '<div class="champ"><label for="rd-o">Objet</label><input type="text" id="rd-o" value="'+esc(t.objet)+'"></div>'+
    '<div class="champ"><label for="rd-m">Message</label><textarea id="rd-m" rows="11">'+esc(t.texte)+'</textarea></div>'+
    '<div class="ligne-btn"><button class="btn clair" id="rd-retour">Retour</button><button class="btn" id="rd-ok">'+I.envoyer+'Envoyer la relance</button></div>');
  $('fenetre').classList.add('large-fen');
  $('rd-retour').onclick=function(){fenetreDemande(d.id)};
  $('rd-ok').onclick=function(){var b=this;b.disabled=true;
    api('demandes/'+d.id+'/relance',{method:'POST',body:{objet:$('rd-o').value,texte:$('rd-m').value}}).then(function(n){majDemandeLocale(n);fermerFenetre();toast('Relance envoyée à '+n.email+'.');if(admPage==='demandes')rendreDemandes()}).catch(function(e){b.disabled=false;toast(e.message)});
  };
}
// Calendrier du mois : demandes datées et galeries (mariages, séances)
function calendrierDemandes(l){
  var base=DEM.mois||new Date(),an=base.getFullYear(),mo=base.getMonth();
  var debut=new Date(an,mo,1),decal=(debut.getDay()+6)%7,nbj=new Date(an,mo+1,0).getDate();
  var iso=function(j){return an+'-'+String(mo+1).padStart(2,'0')+'-'+String(j).padStart(2,'0')};
  var liees={};(DEMANDES||[]).forEach(function(d){if(d.collectionId)liees[d.collectionId]=1});
  var auj=new Date().toISOString().slice(0,10),cases='';
  for(var i=0;i<decal;i++)cases+='<div class="cal-j vide"></div>';
  for(var j=1;j<=nbj;j++){
    var jour=iso(j);
    var dems=l.filter(function(d){return d.dateEvt===jour&&d.statut!=='perdue'});
    var colls=collections().filter(function(c){return c.date===jour&&!liees[c.id]});
    var pris=dems.filter(function(d){return d.statut==='reservee'||d.statut==='livree'}).length+colls.filter(function(c){return c.classeur!=='Événements'}).length;
    cases+='<div class="cal-j'+(jour===auj?' auj':'')+(pris>1?' double':'')+'"><span class="cal-n">'+j+'</span>'+
      dems.map(function(d){var ok=d.statut==='reservee'||d.statut==='livree';return '<button class="cal-ev '+(ok?'ok':'option')+'" data-cal-dem="'+d.id+'" title="'+esc(nomDemande(d))+' · '+ETAPES.filter(function(e){return e[0]===d.statut})[0][1]+'">'+esc(nomDemande(d))+'</button>'}).join('')+
      colls.map(function(c){return '<button class="cal-ev galerie" data-cal-coll="'+c.id+'" title="Galerie : '+esc(c.nom)+'">'+esc(c.nom.replace(/^(Mariage|Séance couple|Séance famille|Séance maternité|Séance)\s+/,''))+'</button>'}).join('')+
    '</div>';
  }
  var titre=debut.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  return '<div class="cal"><div class="cal-tete"><button class="ibtn" data-cal-mois="-1" aria-label="Mois précédent">'+I.retour+'</button><h2>'+titre.charAt(0).toUpperCase()+titre.slice(1)+'</h2><button class="ibtn cal-suiv" data-cal-mois="1" aria-label="Mois suivant">'+I.retour+'</button><button class="lienbtn" data-cal-mois="0">Aujourd’hui</button>'+
    '<span class="cal-legende"><i class="ok"></i>Réservé<i class="option"></i>En option<i class="galerie"></i>Galerie</span></div>'+
    '<div class="cal-grille">'+['lun.','mar.','mer.','jeu.','ven.','sam.','dim.'].map(function(x){return '<div class="cal-jn">'+x+'</div>'}).join('')+cases+'</div></div>';
}
function fenetreAjoutDemande(){
  fenetre(enteteFen('Ajouter une demande')+'<p class="note">Pour une demande reçue en dehors du formulaire : Instagram, WhatsApp, téléphone, bouche-à-oreille…</p>'+
    '<div class="champ"><span class="etiquette-champ">Type</span><div class="options" role="radiogroup" style="grid-template-columns:1fr 1fr">'+
      '<label class="option"><span class="g"><input type="radio" name="ad-type" value="mariage" checked><span>Mariage</span></span></label><label class="option"><span class="g"><input type="radio" name="ad-type" value="seance"><span>Séance photo</span></span></label></div></div>'+
    '<div class="dem-grille"><div class="champ"><label for="ad-nom">Nom et prénom</label><input type="text" id="ad-nom"></div>'+
    '<div class="champ"><label for="ad-conjoint">Conjoint(e) <span class="note">facultatif</span></label><input type="text" id="ad-conjoint"></div>'+
    '<div class="champ"><label for="ad-email">E-mail</label><input type="email" id="ad-email" placeholder="prenom@exemple.fr"></div>'+
    '<div class="champ"><label for="ad-tel">Téléphone ou WhatsApp</label><input type="tel" id="ad-tel"></div>'+
    '<div class="champ"><label for="ad-date">Date de l’événement</label><input type="date" id="ad-date"></div>'+
    '<div class="champ"><label for="ad-source">Provenance</label><input type="text" id="ad-source" placeholder="Ex. : Instagram"></div></div>'+
    '<div class="champ"><label for="ad-msg">Message ou besoin</label><textarea id="ad-msg" rows="3"></textarea></div>'+
    '<div class="ligne-btn"><button class="btn clair" data-ferme>Annuler</button><button class="btn" id="ad-ok">Ajouter</button></div>');
  $('ad-nom').focus();
  $('ad-ok').onclick=function(){
    var nom=$('ad-nom').value.trim();if(!nom){toast('Indiquez au moins un nom.');$('ad-nom').focus();return}
    var b=this;b.disabled=true;
    api('demandes',{method:'POST',body:{type:document.querySelector('[name=ad-type]:checked').value,nom:nom,prenom:nom.split(/\s+/)[0],conjoint:$('ad-conjoint').value.trim(),email:$('ad-email').value.trim(),tel:$('ad-tel').value.trim(),dateEvt:$('ad-date').value,source:$('ad-source').value.trim(),message:$('ad-msg').value.trim()}})
      .then(function(){fermerFenetre();toast('Demande ajoutée.');return ouvrirDemandes()}).catch(function(e){b.disabled=false;toast(e.message)});
  };
}
function fenetreRelierFormulaire(){
  api('demandes/cle').then(function(r){
    var code="/* Envoi de chaque demande à la vue photographe (galerie.melissa-simeon.com) */\nconst GALERIE = {\n  URL: 'https://galerie.melissa-simeon.com/api/demandes',\n  CLE: '"+r.cle+"'\n};\nfunction relayerGalerie(data, type) {\n  try {\n    UrlFetchApp.fetch(GALERIE.URL, {\n      method: 'post', contentType: 'application/json', muteHttpExceptions: true,\n      headers: { 'x-cle-formulaire': GALERIE.CLE },\n      payload: JSON.stringify(Object.assign({}, data, { type: type }))\n    });\n  } catch (e) { console.error(e); }\n}";
    fenetre(enteteFen('Relier le formulaire')+'<p>Le formulaire continue d’envoyer ses e-mails comme aujourd’hui. On ajoute simplement une étape au script Google : il transmet chaque demande à votre vue photographe.</p>'+
      '<ol class="etapes-relier"><li>Dans Apps Script, collez ce code <b>tout en bas</b> du fichier.</li><li>Dans la fonction <code>doPost</code>, ajoutez <code>relayerGalerie(data, \'mariage\');</code> juste après l’enregistrement du devis mariage, et <code>relayerGalerie(data, \'seance\');</code> après celui des séances.</li><li>Enregistrez, puis <b>Déployer → Gérer les déploiements → crayon → Nouvelle version</b>. Google demandera d’autoriser la connexion à un service externe.</li></ol>'+
      '<p class="note">Ce code contient une clé privée : ne le partagez pas.</p><pre class="code-bloc" id="rf-code">'+esc(code)+'</pre>'+
      '<div class="ligne-btn"><button class="btn clair" data-ferme>Fermer</button><button class="btn" id="rf-copier">'+I.dupliquer+'Copier le code</button></div>');
    $('fenetre').classList.add('large-fen');
    $('rf-copier').onclick=function(){copier(code,'Code copié.')};
  }).catch(function(e){toast(e.message)});
}

/* ---------- Démarrage ---------- */
if(MODE==='admin'){
  $('acces').hidden=true;$('galerie').hidden=true;$('admin').hidden=false;
  var m0=location.hash.match(/c=([a-z0-9]+)/);
  Promise.all([chargerCollections(),chargerDemandes().catch(function(){})]).then(function(){
    if(/demandes/.test(location.hash))return ouvrirDemandes();
    if(m0)return ouvrirCollection(m0[1]).then(function(ok){if(!ok)rendreCollections()});
    rendreCollections();
  }).catch(function(e){$('admin').innerHTML='<div class="vide" style="padding:80px 20px"><h3>Impossible de charger vos collections</h3><span>'+esc(e.message)+'</span></div>'});
  window.addEventListener('beforeunload',function(e){if(document.querySelector('.envoi-prog:not([hidden])')&&/gardez/.test(($('envoi-txt')||{}).textContent||'')){e.preventDefault();e.returnValue=''}});
}else{
  $('admin').hidden=true;$('acces').hidden=true;
  majNoms();majDateEvt();setTimeout(initOeil);
  if(APERCU){$('bandeau-apercu').hidden=false}
  // Déjà connecté (cookie valide) : on ouvre directement la galerie
  chargerClient().then(function(){ouvrirGalerie();guideALaConnexion(false)}).catch(function(e){
    if(APERCU){$('err-acces').textContent='Aperçu indisponible : ouvrez d’abord votre vue photographe.'}
    $('acces').hidden=false;majMur();
  });
}
})();
