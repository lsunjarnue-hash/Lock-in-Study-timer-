(function () {
  const backBtn = document.querySelector(".back-btn");
  if (!backBtn) {
    return;
  }

  backBtn.addEventListener("click", function () {
    if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          window.history.back();
          return;
        }
      } catch (error) {}
    }
    window.location.href = "index.html";
  });
})();
