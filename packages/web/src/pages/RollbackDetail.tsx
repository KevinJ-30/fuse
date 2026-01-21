import { useParams } from 'react-router-dom';

export default function RollbackDetail() {
  const { id } = useParams();

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-100">Rollback Detail</h3>
        <p className="text-sm text-gray-400 mt-1">Rollback ID: {id}</p>
      </div>

      <div className="space-y-6">
        <div className="bg-dark-100 rounded-lg shadow p-6 border border-gray-800">
          <h4 className="font-semibold mb-4 text-gray-100">Blast Radius</h4>
          <p className="text-gray-400">Blast radius visualization will be shown here</p>
        </div>

        <div className="bg-dark-100 rounded-lg shadow p-6 border border-gray-800">
          <h4 className="font-semibold mb-4 text-gray-100">Compensation Plan</h4>
          <p className="text-gray-400">List of compensations to execute will be shown here</p>
        </div>
      </div>
    </div>
  );
}
