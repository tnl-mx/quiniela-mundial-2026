// Acceso DISCRETO al panel del organizador (#/admin).
//
// Es un engrane chiquito y tenue en una esquina, para que el organizador entre
// desde cualquier vista sin guardar el link. No llama la atencion de los
// usuarios normales; y aunque alguien lo toque, #/admin igual pide el PIN.
// Se monta en App.jsx en TODAS las rutas menos #/admin.

export function AdminGear() {
  return (
    <a className="admin-gear" href="#/admin" title="Panel del organizador" aria-label="Panel del organizador">
      ⚙
    </a>
  )
}
