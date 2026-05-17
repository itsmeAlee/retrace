export function Footer() {
  return (
    <footer className="bg-surface border-t border-border w-full pt-16 pb-8">
      <div className="max-w-[1200px] mx-auto px-5 md:px-16 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="text-center md:text-left">
          <div className="font-serif text-body-lg font-bold text-primary mb-2">Retrace</div>
          <p className="text-text-secondary font-sans text-base leading-[1.65]">© 2024 Retrace. The modern scholar's companion.</p>
        </div>
        <div className="flex gap-8 items-center">
          <a className="text-text-secondary hover:text-secondary transition-colors font-sans text-button tracking-wide hover:underline" href="#">Privacy</a>
          <a className="text-text-secondary hover:text-secondary transition-colors font-sans text-button tracking-wide hover:underline" href="#">Terms</a>
          <a className="text-text-secondary hover:text-secondary transition-colors font-sans text-button tracking-wide hover:underline" href="#">Twitter</a>
          <a className="text-text-secondary hover:text-secondary transition-colors font-sans text-button tracking-wide hover:underline" href="#">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}
