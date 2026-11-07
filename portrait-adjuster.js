(function() {
    'use strict';
    class PortraitAdjuster {
        constructor(options) {
            this.root=options.root;this.input=options.input;this.onChange=options.onChange||(()=>{});this.onClear=options.onClear||(()=>{});
            this.canvas=this.root.querySelector('canvas');this.context=this.canvas.getContext('2d');
            this.panel=this.root.querySelector('[data-photo-panel]');this.error=this.root.querySelector('[data-photo-error]');
            this.zoom=this.root.querySelector('[data-photo-zoom]');this.output=this.root.querySelector('output');
            this.generation=0;this.ready=false;this.loading=false;this.errorMessage='';this.url=null;this.drag=null;this.image=null;
            this.zoom.addEventListener('input',()=>this.applyZoom());
            this.root.querySelector('[data-photo-center]').addEventListener('click',()=>this.center());
            this.root.querySelector('[data-photo-clear]').addEventListener('click',()=>this.clear());
            this.canvas.addEventListener('pointerdown',event=>{
                if(!this.ready)return;event.preventDefault();this.canvas.focus();this.canvas.setPointerCapture(event.pointerId);
                this.drag={x:event.clientX,y:event.clientY,offsetX:this.offsetX,offsetY:this.offsetY};
            });
            this.canvas.addEventListener('pointermove',event=>{
                if(!this.drag||!this.ready)return;const bounds=this.canvas.getBoundingClientRect();
                this.offsetX=this.drag.offsetX+(event.clientX-this.drag.x)*this.canvas.width/bounds.width;
                this.offsetY=this.drag.offsetY+(event.clientY-this.drag.y)*this.canvas.height/bounds.height;this.draw();
            });
            ['pointerup','pointercancel','lostpointercapture'].forEach(name=>this.canvas.addEventListener(name,()=>this.drag=null));
            this.canvas.addEventListener('keydown',event=>{
                if(!this.ready||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
                event.preventDefault();const step=event.shiftKey?20:5;
                if(event.key==='ArrowLeft')this.offsetX-=step;if(event.key==='ArrowRight')this.offsetX+=step;
                if(event.key==='ArrowUp')this.offsetY-=step;if(event.key==='ArrowDown')this.offsetY+=step;this.draw();
            });
        }
        clear(notify=true) {
            this.generation++;this.ready=false;this.loading=false;this.image=null;this.drag=null;this.errorMessage='';this.input.value='';
            if(this.url)URL.revokeObjectURL(this.url);this.url=null;this.root.hidden=true;this.panel.hidden=true;this.error.hidden=true;
            this.zoom.value='1';this.output.value='100%';if(notify)this.onClear();
        }
        fail(message) {
            this.ready=false;this.loading=false;this.errorMessage=message;this.root.hidden=false;this.panel.hidden=true;
            this.error.textContent=message;this.error.hidden=false;this.input.value='';return false;
        }
        async load(file) {
            this.clear(false);if(!file)return false;
            if(!['image/jpeg','image/png','image/webp'].includes(file.type))return this.fail('請選擇 JPG、PNG 或 WebP 照片。');
            if(file.size>12*1024*1024)return this.fail('照片請小於 12 MB。');
            try {const transfer=new DataTransfer();transfer.items.add(file);this.input.files=transfer.files;}
            catch(_){return this.fail('此瀏覽器無法選取圖片，請改用較新的瀏覽器。');}
            this.loading=true;this.root.hidden=false;const token=this.generation;this.url=URL.createObjectURL(file);
            return new Promise(resolve=>{
                const image=new Image();
                image.onload=()=>{
                    if(token!==this.generation){resolve(false);return;}
                    if(image.naturalWidth*image.naturalHeight>32000000){resolve(this.fail('照片尺寸過大，請先縮小後再上傳。'));return;}
                    this.image=image;this.loading=false;this.ready=true;this.panel.hidden=false;this.error.hidden=true;this.center();resolve(true);
                };
                image.onerror=()=>{if(token===this.generation)resolve(this.fail('無法讀取照片，請重新選擇有效的圖片。'));else resolve(false);};
                image.src=this.url;
            });
        }
        center() {
            if(!this.ready)return;this.zoom.value='1';
            this.scale=Math.max(this.canvas.width/this.image.naturalWidth,this.canvas.height/this.image.naturalHeight);
            this.offsetX=(this.canvas.width-this.image.naturalWidth*this.scale)/2;
            this.offsetY=(this.canvas.height-this.image.naturalHeight*this.scale)/2;this.draw();
        }
        applyZoom() {
            if(!this.ready)return;const previous=this.scale;
            this.scale=Math.max(this.canvas.width/this.image.naturalWidth,this.canvas.height/this.image.naturalHeight)*Number(this.zoom.value);
            this.offsetX=this.canvas.width/2-(this.canvas.width/2-this.offsetX)*this.scale/previous;
            this.offsetY=this.canvas.height/2-(this.canvas.height/2-this.offsetY)*this.scale/previous;this.draw();
        }
        crop() {
            if(!this.ready)return null;
            return {x:-this.offsetX/this.scale,y:-this.offsetY/this.scale,width:this.canvas.width/this.scale,height:this.canvas.height/this.scale};
        }
        draw() {
            if(!this.ready)return;
            this.offsetX=Math.min(0,Math.max(this.canvas.width-this.image.naturalWidth*this.scale,this.offsetX));
            this.offsetY=Math.min(0,Math.max(this.canvas.height-this.image.naturalHeight*this.scale,this.offsetY));
            this.context.fillStyle='#fff';this.context.fillRect(0,0,this.canvas.width,this.canvas.height);
            this.context.drawImage(this.image,this.offsetX,this.offsetY,this.image.naturalWidth*this.scale,this.image.naturalHeight*this.scale);
            this.output.value=Math.round(Number(this.zoom.value)*100)+'%';this.onChange(this.crop());
        }
        blocked() {return this.loading||Boolean(this.errorMessage);}
        exportJPEG() {
            if(!this.ready||this.blocked())throw new Error('請先完成照片調整。');
            const crop=this.crop(),output=document.createElement('canvas');output.width=600;output.height=740;
            const context=output.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,600,740);
            context.drawImage(this.image,crop.x,crop.y,crop.width,crop.height,0,0,600,740);return output.toDataURL('image/jpeg',0.92);
        }
    }
    window.PortraitAdjuster=PortraitAdjuster;
})();
