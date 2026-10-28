window.__ModuleLoader__.load({id:'qcu-branding',factory:require=>{
  const {jsx}=require('react/jsx-runtime');
  const icon='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSI+CiAgPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTQiIGZpbGw9IiMxNzRGOTEiLz4KICA8cGF0aCBkPSJNMjAgMzFWMjBDMjAgMTAgNDQgMTAgNDQgMjBWMzFIMzhWMjFDMzggMTcgMjYgMTcgMjYgMjFWMzFIMjBaIiBmaWxsPSIjRkZGIi8+CiAgPHBhdGggZD0iTTEyIDM3QzIwIDM0IDI2IDM2IDMyIDQxQzM4IDM2IDQ0IDM0IDUyIDM3VjQ5QzQ0IDQ2IDM4IDQ4IDMyIDUzQzI2IDQ4IDIwIDQ2IDEyIDQ5VjM3WiIgZmlsbD0iI0ZGRiIvPgogIDxwYXRoIGQ9Ik0zMiA0MVY1MyIgc3Ryb2tlPSIjMTc0RjkxIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPHBhdGggZD0iTTE2IDQyQzIxIDQxIDI1IDQyIDI4IDQ0TTM2IDQ0QzM5IDQyIDQzIDQxIDQ4IDQyIiBzdHJva2U9IiM5QUQ1RjEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo=';
  function Mark({size=24,className}){return jsx('img',{src:icon,width:size,height:size,className,alt:'',draggable:false,style:{display:'block',flexShrink:0}})}
  function Name(){return jsx('span',{style:{fontFamily:'"PingFang SC","Microsoft YaHei",sans-serif',fontSize:17,fontWeight:650,letterSpacing:'.02em',whiteSpace:'nowrap'},children:'QCU助手'})}
  function apply(ctx){
    ctx.slots.inject('sidebar.brand.mark',()=>ctx.slots.inject('sidebar.brand.name',function*(){
      yield ctx.slots.register({name:'sidebar.brand.mark'},Mark);
      yield ctx.slots.register({name:'sidebar.brand.name'},Name);
    }));
    ctx.slots.inject('conversation.hero.brand.mark',()=>ctx.slots.register({name:'conversation.hero.brand.mark'},Mark));
  }
  return {inject:['slots'],apply};
}});
