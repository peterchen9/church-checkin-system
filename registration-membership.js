let registrationMembershipChoices=null;
async function loadRegistrationMembership(){
    const response=await fetch('api/admin.php?action=registration_membership_choices',{cache:'no-store'});
    const result=await response.json();if(!response.ok||!result.success)throw new Error(result.message||'牧區與小家載入失敗，請稍後重試。');
    registrationMembershipChoices=result;
    const select=control('section');select.replaceChildren(new Option('尚未決定',''));
    result.sections.forEach(section=>select.add(new Option(section.parent_name?`${section.parent_name}／${section.name}`:section.name,section.name)));
    select.addEventListener('change',()=>updateRegistrationGroups());
}
function updateRegistrationGroups(preferred='',preserveLegacy=false){
    const section=registrationMembershipChoices.sections.find(item=>item.name===control('section').value);
    const groups=section?registrationMembershipChoices.groups.filter(item=>String(item.section_id)===String(section.id)):[];
    const select=control('family1');select.replaceChildren(new Option('請選擇小家',''));
    groups.forEach(group=>select.add(new Option(group.name,group.name)));
    if(preserveLegacy&&preferred&&!groups.some(group=>group.name===preferred))select.add(new Option(`目前資料：${preferred}`,preferred));
    select.value=preferred;
    const visible=Boolean(groups.length||(preserveLegacy&&preferred));
    document.getElementById('contact-group-field').hidden=!visible;
    document.getElementById('contact-membership-row').classList.toggle('has-groups',visible);
    select.disabled=!visible;
    select.required=Boolean(groups.length);
}
function setRegistrationMembership(section,group,preserveLegacy){
    const select=control('section');
    if(preserveLegacy&&section&&![...select.options].some(option=>option.value===section))select.add(new Option(`目前資料：${section}`,section));
    select.value=section;updateRegistrationGroups(group,preserveLegacy);
}
function registrationMembershipPayload(isNew){
    if(!isNew && loadedContact && control('section').value===(loadedContact.section||'') && control('family1').value===(loadedContact.family1||''))return {};
    const section=registrationMembershipChoices.sections.find(item=>item.name===control('section').value);
    const groups=section?registrationMembershipChoices.groups.filter(item=>String(item.section_id)===String(section.id)):[];
    const group=groups.find(item=>item.name===control('family1').value);
    if(groups.length&&!group)throw new Error('請選擇此牧區的小家。');
    if(!isNew && !section)return {};
    if(control('section').value&&!section)throw new Error('請重新選擇預歸屬牧區。');
    return {planned_section_id:section?section.id:'',planned_group_id:group?group.id:''};
}
