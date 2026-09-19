/**
 * Inline editable text.
 *
 *   <span class="edit" data-handle="always|hover">
 *     <input class="edit-in" …>       looks like plain text until focused, then like a text box
 *     <span class="edit-mirror">      measures the text so the box hugs its content
 *     <button class="edit-pen">       pencil handle at rest; swapped for…
 *     <button class="edit-cancel">    …an × of the same size while editing (restores the old text)
 *   </span>
 *
 * Enter commits, Escape or × cancels. The box is sized to its content (up to
 * the container) on render and on every keystroke. State binding is left to
 * the caller: the input carries whatever data-* attributes are passed
 * (e.g. data-f="name") and fires ordinary `input` events.
 */
import { icon } from "./icons.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/**
 * HTML for an editable field. attrs is a string of extra attributes for the <input>.
 *   side     "right" (handle after the text) or "left" (before it: for right-aligned numbers)
 *   inset    keep the handle inside the box instead of hanging outside it (for a full-width field)
 *   fit      false leaves the box at its CSS width instead of hugging the text
 *   type     input type; inputCls extra classes on the input; pen the handle's icon
 */
export function editable({ value, attrs="", cls="", inputCls="", placeholder="", handle="hover", label="Edit", side="right", inset=false, fit=true, type="text", pen="pencil" }){
  return `<span class="edit ${cls} side-${side}${inset?" inset":""}${fit?"":" nofit"}" data-handle="${handle}">`
    + `<input type="${type}" class="edit-in ${inputCls}" value="${esc(value)}" placeholder="${esc(placeholder)}" spellcheck="false" autocomplete="off" ${attrs}>`
    + `<span class="edit-mirror" aria-hidden="true"></span>`
    + `<button type="button" class="edit-pen" tabindex="-1" aria-label="${esc(label)}" title="${esc(label)}">${icon(pen,14)}</button>`
    + `<button type="button" class="edit-cancel" tabindex="-1" aria-label="Cancel" title="Cancel (Esc)">${icon("x",14)}</button></span>`;
}

/** Size one input to its text: the mirror carries the same font and padding, plus border and caret. */
export function fit(input){
  if(input.closest(".edit.nofit")) return;
  const mirror = input.parentElement?.querySelector(".edit-mirror"); if(!mirror) return;
  mirror.textContent = input.value || input.placeholder || " ";
  input.style.width = (Math.ceil(mirror.getBoundingClientRect().width) + 6) + "px";
}
export function fitAll(root=document){ root.querySelectorAll(".edit .edit-in").forEach(fit); }

function cancel(input){
  if(input.dataset.orig !== undefined && input.value !== input.dataset.orig){
    input.value = input.dataset.orig;
    input.dispatchEvent(new Event("input", { bubbles:true }));
  }
  input.blur();
}

/** One-time delegated wiring for every editable on the page, present or future. */
export function initEditable(){
  document.addEventListener("click", e=>{
    const pen = e.target.closest(".edit-pen"); if(!pen) return;
    const input = pen.parentElement.querySelector(".edit-in");
    input.focus(); input.select();
  });
  // mousedown, not click: a click would blur the input first and hide the button before it fires
  document.addEventListener("mousedown", e=>{
    const x = e.target.closest(".edit-cancel"); if(!x) return;
    e.preventDefault(); cancel(x.parentElement.querySelector(".edit-in"));
  });
  document.addEventListener("focusin", e=>{ if(e.target.matches(".edit-in")) e.target.dataset.orig = e.target.value; });
  document.addEventListener("input", e=>{ if(e.target.matches(".edit .edit-in")) fit(e.target); });
  document.addEventListener("keydown", e=>{
    if(!e.target.matches(".edit-in")) return;
    if(e.key==="Enter"){ e.preventDefault(); e.target.blur(); }
    else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); cancel(e.target); }
  });
  if(document.fonts?.ready) document.fonts.ready.then(()=> fitAll());
  window.addEventListener("resize", ()=> fitAll());
}
