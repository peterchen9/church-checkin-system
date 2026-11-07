// Edit only fields changed by this form; leave platform/system fields untouched.
let photoBase64=null, photoAction='keep', loadedContact=null, formReady=false, initialValues=null;
const contactFields={name:'name',phone_h:'phone_h',phone_o:'phone_o',mobile1:'mobile',address:'address',email1:'email',section:'section',family1:'family1',family_id:'family_id',note:'note',join_date:'join_date',dataindate:'dataindate',car_number:'car_number',line_id:'line_id'};
const codes={gender:{M:'M',m:'M',male:'M','男':'M',F:'F',f:'F',female:'F','女':'F'},marriage:{m:'m',M:'m',yes:'m','已婚':'m',s:'s',S:'s',no:'s','未婚':'s'},baptized:{y:'y',Y:'y',yes:'y','已受洗':'y',n:'n',N:'n',no:'n','慕道友':'n','未受洗':'n'}};
const control=id=>document.getElementById('contact-'+id);
function setRadioValue(field,value){
    let canonical=value==null||value===''||value==='未填寫'?'':(codes[field][value]??value);
    const radios=[...document.getElementsByName(field)];
    if(!radios.some(r=>r.value===canonical)){
        const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=field;input.value=canonical;
        label.append(input,document.createTextNode(' 原資料：'+canonical+'（未變更時保留）'));radios[0].parentElement.parentElement.appendChild(label);radios.push(input);
    }
    radios.forEach(r=>r.checked=r.value===canonical);
}
function getRadioValue(field){return document.querySelector(`input[name="${field}"]:checked`)?.value??'';}
function setBirthday(value){
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    ['year','month','day'].forEach((part,index)=>control('b_'+part).value=match?String(Number(match[index+1])-(index===0?1911:0)):'');
}
function birthdayValue(){
    const values=['year','month','day'].map(part=>control('b_'+part).value.trim());
    if(values.every(v=>!v))return null;
    if(values.some(v=>!/^\d+$/.test(v)))throw new Error('生日請完整輸入民國年、月、日，或全部留空。');
    const [roc,month,day]=values.map(Number),year=roc+1911;
    const date=new Date(Date.UTC(year,month-1,day));
    if(roc<1||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('生日日期不正確。');
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function dateToRoc(value){
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match?`${Number(match[1])-1911}-${Number(match[2])}-${Number(match[3])}`:'';
}
function dateFromRoc(value){
    if(!value)return '';
    const match=String(value).match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
    if(!match)throw new Error('聚會日期與填卡日期請輸入民國年-月-日。');
    const year=Number(match[1])+1911,month=Number(match[2]),day=Number(match[3]);
    const date=new Date(Date.UTC(year,month-1,day));
    if(Number(match[1])<1||year>9999||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw new Error('聚會日期或填卡日期不正確。');
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function formValues(){
    const values={};for(const [field,id]of Object.entries(contactFields))values[field]=control(id).value.trim();
    for(const field of ['join_date','dataindate'])values[field]=dateFromRoc(values[field]);
    for(const field of ['gender','marriage','baptized'])values[field]=getRadioValue(field);
    values.birthday_parts=['year','month','day'].map(part=>control('b_'+part).value.trim()).join('/');
    values.visitor_choices=[...document.querySelectorAll('#visitor-info-container input:checked')].map(i=>i.value);
    values.emergency_contact={name:control('emer_name').value.trim(),phone:control('emer_phone').value.trim(),relation:control('emer_relation').value.trim()};
    return values;
}
function displayPhoto(src){
    const image=document.getElementById('photo-preview');image.src=src;image.style.display='block';
    document.getElementById('photo-placeholder').style.display='none';document.getElementById('remove-photo-btn').style.display='inline-block';
}
function handleCameraUpload(event){if(event.target.files[0])processFile(event.target.files[0]);}
function processFile(file){return newFriendPortrait.load(file);}
window.addEventListener('paste',event=>{if(formReady&&event.clipboardData.files[0])processFile(event.clipboardData.files[0]);});
function removePhoto(){newFriendPortrait.clear(false);photoBase64=null;photoAction='remove';document.getElementById('photo-preview').style.display='none';document.getElementById('photo-placeholder').style.display='block';document.getElementById('remove-photo-btn').style.display='none';}
async function initForm(){
    const button=document.querySelector('.submit-btn');button.disabled=true;
    const id=new URLSearchParams(location.search).get('id');
    try{
        const auth=await (await fetch('api/login.php?action=check')).json();if(!auth.success){location.href='http://192.168.16.240:8033/official-login.php?v=20261027-login-return';return;}
        await loadRegistrationMembership();
        if(id){
            const response=await fetch('api/admin.php?action=get_contact&church_id='+encodeURIComponent(id));const result=await response.json();
            if(!result.success)throw new Error(result.message||'讀取資料失敗。');
            loadedContact=result.data;document.getElementById('contact-church-id').value=id;
            document.getElementById('contact-edit-extra').hidden=false;
            document.getElementById('page-title').textContent='檢視／編輯平台通訊錄';button.textContent='儲存更新';
            for(const [field,element]of Object.entries(contactFields)){if(['section','family1'].includes(field))continue;control(element).value=['join_date','dataindate'].includes(field)?dateToRoc(loadedContact[field]):(loadedContact[field]??'');}
            setRegistrationMembership(loadedContact.section||'',loadedContact.family1||'',true);
            document.getElementById('contact-section-label').textContent='牧區';
            for(const field of ['gender','marriage','baptized'])setRadioValue(field,loadedContact[field]);setBirthday(loadedContact.birthday);
            const visitorSource=((loadedContact.visitor_info||'')+' '+(loadedContact.note||'')).replaceAll('我目前還沒固定','我目前還沒有固定');
            document.querySelectorAll('#visitor-info-container input').forEach(i=>i.checked=visitorSource.includes(i.value));
            const emergency=String(loadedContact.note||'').match(/\[緊急聯絡人:\s*(.*?)\s*\((.*?)\)\s*([^\]]*)\]/);
            if(emergency){control('emer_name').value=emergency[1];control('emer_relation').value=emergency[2];control('emer_phone').value=emergency[3];}
            if(loadedContact.has_photo)displayPhoto(loadedContact.photo_url+'&v='+encodeURIComponent(loadedContact.photo_version));
            document.getElementById('attendance-summary').textContent=`首次打卡：${loadedContact.first_daka||'未記錄'}　最近打卡：${loadedContact.last_checkin||'未記錄'}　近12個月出席：${loadedContact.att_12m??'未記錄'}`;
        }else{
            const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
            control('join_date').value=dateToRoc(today);control('dataindate').value=dateToRoc(today);setRegistrationMembership('','',false);
        }
        initialValues=formValues();formReady=true;button.disabled=false;
    }catch(error){alert(error.message||'讀取失敗，請重新整理。');}
}
async function saveContact(){
    if(!formReady)return;
    let payload;const button=document.querySelector('.submit-btn');
    try{
        const values=formValues();if(!values.name)throw new Error('姓名為必填欄位。');
        const id=document.getElementById('contact-church-id').value;
        payload={action:id?'update_contact':'add_contact',schema_version:2,church_id:id,original_values:{},...registrationMembershipPayload(!id)};
        for(const key of [...Object.keys(contactFields),'gender','marriage','baptized']){
            if(!id||values[key]!==initialValues[key]){payload[key]=values[key];if(id)payload.original_values[key]=loadedContact[key]??null;}
        }
        if(!id||values.birthday_parts!==initialValues.birthday_parts){payload.birthday=birthdayValue();if(id)payload.original_values.birthday=loadedContact.birthday??null;}
        for(const key of ['visitor_choices','emergency_contact']){
            if(JSON.stringify(values[key])!==JSON.stringify(initialValues[key])){
                payload[key]=values[key];if(id){payload.original_values.note=loadedContact.note??null;payload.original_values.visitor_info=loadedContact.visitor_info??null;}
            }
        }
        if(newFriendPortrait.blocked())throw new Error(newFriendPortrait.errorMessage||'照片仍在載入，請稍候再儲存。');
        if(photoAction==='replace')photoBase64=newFriendPortrait.exportJPEG();
        if(photoAction!=='keep'){payload.photo_action=photoAction;payload.photo_version=loadedContact?.photo_version??'';if(photoAction==='replace')payload.photo_base64=photoBase64;}
        button.disabled=true;button.textContent='儲存中...';
        const response=await fetch('api/admin.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const result=await response.json();if(!result.success)throw new Error(result.message||'儲存未完成。');
        alert(id?'更新成功！':'新增成功！會友編號為：'+result.new_church_id);location.href='http://192.168.16.240:8033/admin.html?tab=contacts';
    }catch(error){alert(error.message||'儲存失敗，請重試。');button.disabled=false;button.textContent=loadedContact?'儲存更新':'送出登記';}
}
const newFriendPortrait=new PortraitAdjuster({
    root:document.getElementById('newFriendPhotoEditor'),input:document.getElementById('camera-input'),
    onChange:()=>{photoAction='replace';displayPhoto(newFriendPortrait.canvas.toDataURL('image/jpeg',.8));},
    onClear:()=>{
        photoBase64=null;photoAction='keep';
        if(loadedContact?.has_photo)displayPhoto(loadedContact.photo_url+'&v='+encodeURIComponent(loadedContact.photo_version));
        else {document.getElementById('photo-preview').style.display='none';document.getElementById('photo-placeholder').style.display='block';document.getElementById('remove-photo-btn').style.display='none';}
    }
});

initForm();
