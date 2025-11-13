import FitmasCard from './components/FitmasCard'

function App() {
  return (
    <div style={{ width: '70vw', height: '100vh' }}>
       <FitmasCard  memberData={{
        name: 'JANE SMITH',
        memberId: 'FIT-2024-042',
        memberType: 'PLATINUM',
        validUntil: 'JAN 2026'
      }}/> 
      {/* <FitmasCard /> */}
    </div>
  )
}
export default App
