// Markdown is an editing surface; structured content remains the asset's source.
const LABELS = {title:'标题',subtitle:'副标题',items:'要点',stages:'阶段',rows:'数据',lines:'文字',steps:'步骤',name:'名称',label:'文字',value:'数值',suffix:'单位',id:'标识',detail:'说明',icon:'图标',stepMs:'每步间隔',activeStageIndex:'当前阶段',cues:'字幕',chapters:'章节',points:'数据点',text:'文字',startMs:'开始毫秒',endMs:'结束毫秒',translation:'英文',unit:'单位',caption:'图注',source:'来源',author:'署名',kicker:'眉题',chips:'名牌',media:'素材',center:'中心',branches:'分支',children:'子节点',en:'英文',definition:'定义',term:'术语',publisher:'发布方',url:'链接',src:'素材路径',kind:'类型',width:'宽度',opacity:'不透明度',radius:'圆角',fit:'填充方式',frame:'画框',aspect:'宽高比',x:'水平位置',y:'垂直位置',style:'样式',sub:'小字',emphasis:'强调',footEn:'英文脚注',footZh:'中文脚注',noteA:'侧注',noteB:'身份说明',decimals:'小数位',max:'上限',prefix:'前缀'};
export const contentLabel = key => LABELS[key] ?? key;
const escape = value => String(value ?? '').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\n/g,'\\n');
const unescape = value => value.replace(/\\([\\|n])/g,(_,c)=>c==='n'?'\n':c);
const cells = line => line.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split(/(?<!\\)\|/).map(s=>unescape(s.trim()));
const scalar = (raw,field) => {
  if (field.kind==='number') {if(!raw.trim() || !Number.isFinite(Number(raw))) throw Error('数值需要填写数字'); return Number(raw);}
  if (field.kind==='boolean') {if(!['是','否','true','false'].includes(raw)) throw Error('开关请填写“是”或“否”');return raw==='是'||raw==='true';}
  if (['object','array'].includes(field.kind)) {try{return JSON.parse(raw);}catch{throw Error('嵌套数据格式不完整');}}
  return raw;
};
const display = value => typeof value==='boolean'?(value?'是':'否'):typeof value==='object'?JSON.stringify(value):String(value??'');
export function serializeContent(content, descriptor) {
  return descriptor.fields.filter(f=>content[f.key]!==undefined).map(f=>{
    const value=content[f.key];
    if(f.key==='title') return '# '+value;
    if(f.key==='subtitle') return '## '+value;
    if(f.kind==='array') {
      if(f.item.kind==='string') return '## '+contentLabel(f.key)+'\n'+value.map(v=>'- '+v).join('\n');
      if(['items','stages','steps'].includes(f.key)&&f.item.kind==='object'&&f.item.fields.some(x=>['label','title'].includes(x.key))) {
        const textKey=f.item.fields.some(x=>x.key==='label')?'label':'title';
        // Extra per-node data is exposed in named sections below, preserving IDs/icons.
        return '## '+contentLabel(f.key)+'\n'+value.map(v=>'- '+v[textKey]+(v.detail?'\n  '+v.detail:'')).join('\n') +
          (f.item.fields.some(x=>!['id','label','title','detail'].includes(x.key))?'\n### 节点附加字段\n'+table(value,f.item.fields.filter(x=>!['id','label','title','detail'].includes(x.key))):'');
      }
      return '## '+contentLabel(f.key)+'\n'+(f.item.kind==='object'?table(value,f.item.fields.filter(x=>x.key!=='id')):value.map(v=>'- '+display(v)).join('\n'));
    }
    return '## '+contentLabel(f.key)+'\n'+display(value);
  }).join('\n');
}
function table(list,fields) {
  return '| '+fields.map(f=>contentLabel(f.key)).join(' | ')+' |\n| '+fields.map(()=> '---').join(' | ')+' |\n'+list.map(row=>'| '+fields.map(f=>escape(display(row[f.key]))).join(' | ')+' |').join('\n');
}
export function parseContent(text,descriptor,base={}) {
  const result=structuredClone(base), sections=new Map(); let section=null;
  for(const [index,line] of text.split('\n').entries()) {
    if(line.startsWith('# ')){result.title=line.slice(2);continue;}
    if(line.startsWith('## ')) {const name=line.slice(3);const field=descriptor.fields.find(f=>contentLabel(f.key)===name);if(!field&&descriptor.fields.some(f=>f.key==='subtitle')) {result.subtitle=name;section=null;continue;}if(!field) throw Error(`第 ${index+1} 行：无法识别“${name}”`);section=field.key;sections.set(section,[]);continue;}
    if(line.trim()&&!section) throw Error(`第 ${index+1} 行：请保留内容分组标题`);
    if(section) sections.get(section).push({line,index:index+1});
  }
  for(const [key,entries] of sections) {
    const field=descriptor.fields.find(f=>f.key===key), lines=entries.filter(e=>e.line.trim());
    try {
      if(field.kind!=='array'){result[key]=scalar(lines.map(e=>e.line).join('\n'),field);continue;}
      if(field.item.kind!=='object'){result[key]=lines.map(e=>{if(!e.line.startsWith('- '))throw Error(`第 ${e.index} 行：每条内容以“- ”开头`);return scalar(e.line.slice(2),field.item);});continue;}
      const textKey=['label','title','name','text'].find(key=>field.item.fields.some(f=>f.key===key));
      if(lines[0]?.line.startsWith('- ')) {
        const list=[];let extra=false,extraLines=[];
        for(const e of lines){if(e.line==='### 节点附加字段'){extra=true;continue;}if(extra){extraLines.push(e);continue;}if(e.line.startsWith('- '))list.push({[textKey]:e.line.slice(2)});else if(/^\s{2,}\S/.test(e.line)&&list.length)list.at(-1).detail=(list.at(-1).detail?list.at(-1).detail+' ':'')+e.line.trim();else throw Error(`第 ${e.index} 行：节点以“- ”开头，说明缩进两格`);}
        const extras=extraLines.length?parseTable(extraLines,field.item.fields):[];
        result[key]=list.map((row,i)=>({...((base[key]??[]).find(v=>v[textKey]===row[textKey])??base[key]?.[i]??{}),...row,...extras[i],...(field.item.fields.some(f=>f.key==='detail')&&!row.detail?{detail:''}:{})}));
      } else result[key]=parseTable(lines,field.item.fields);
      if(field.item.fields.some(f=>f.key==='id')) {
        const used=new Set();
        result[key]=result[key].map((row,i)=>{
          const original=textKey&&row[textKey]!==undefined?(base[key]??[]).find(v=>v[textKey]===row[textKey]):base[key]?.[i];
          let id=original?.id;
          if(!id||used.has(id)){let n=i+1;do{id=`edit-${key}-${n++}`;}while(used.has(id)||(base[key]??[]).some(v=>v.id===id));}
          used.add(id);return {...row,id};
        });
      }
    }catch(error){throw Error(`${contentLabel(key)}：${error.message}`);}
  }
  validateContent(result,descriptor,'内容');return result;
}
function parseTable(lines,fields) {
  if(!lines.length)return [];
  const headers=cells(lines[0].line).map(name=>{const f=fields.find(f=>contentLabel(f.key)===name);if(!f)throw Error(`未知列“${name}”`);return f;});
  if(!lines[1]||!/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[1].line))throw Error('请保留表格标题下的 --- 分隔行');
  return lines.slice(2).map(e=>{const row=cells(e.line);if(row.length!==headers.length)throw Error(`第 ${e.index} 行：列数应为 ${headers.length}`);return Object.fromEntries(headers.flatMap((f,i)=>row[i]===''?[]:[[f.key,scalar(row[i],f)]]));});
}
function validateContent(value,descriptor,path) {
  if(value===undefined)return;
  if(descriptor.kind==='object') {for(const key of descriptor.schema.required??[])if(value[key]===undefined)throw Error(`${path}缺少${contentLabel(key)}`);for(const f of descriptor.fields)validateContent(value[f.key],f,path+' / '+contentLabel(f.key));}
  if(descriptor.kind==='array') {if(!Array.isArray(value))throw Error(`${path}需要列表`);if(value.length<descriptor.minItems||value.length>descriptor.maxItems)throw Error(`${path}支持 ${descriptor.minItems}–${descriptor.maxItems} 条，当前 ${value.length} 条`);value.forEach((v,i)=>validateContent(v,descriptor.item,path+'第'+(i+1)+'条'));}
  if(descriptor.kind==='string'){if(typeof value!=='string'||value.length<(descriptor.minLength??0)||value.length>(descriptor.maxLength??Infinity))throw Error(`${path}字数需要在 ${descriptor.minLength??0}–${descriptor.maxLength??'不限'} 字内`);if(descriptor.schema.pattern&&!new RegExp(descriptor.schema.pattern).test(value))throw Error(`${path}文字格式不正确`);}
  if(descriptor.kind==='number'&&(!Number.isFinite(value)||value<(descriptor.minimum??-Infinity)||value>(descriptor.maximum??Infinity)||(descriptor.integer&&!Number.isInteger(value))))throw Error(`${path}数值超出允许范围`);
  if(descriptor.kind==='enum'&&!descriptor.values.includes(value))throw Error(`${path}可选：${descriptor.values.join('、')}`);
}
