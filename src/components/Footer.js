import "../styles/footer.css";

export default function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="app-footer">
            <div className="footer-content">
                <p>
                    © {currentYear} Sistema de Registros Digitales - Todos los derechos reservados <strong>DHISVE - Analista de Transformación Digital</strong>
                </p>
            </div>
        </footer>
    );
}